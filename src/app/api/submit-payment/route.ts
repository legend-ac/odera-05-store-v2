import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { submitPaymentSchema } from "@/schemas/submitPayment";
import { verifyAppCheckIfEnabled } from "@/lib/server/appCheckVerify";
import { getRequestIp, getUserAgent } from "@/lib/server/ip";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { sendTransactionalEmail } from "@/lib/server/email";
import { decidePaymentSubmission } from "@/lib/paymentRules";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await verifyAppCheckIfEnabled(req);

    const ip = getRequestIp(req);
    const ua = getUserAgent(req);

    const rate = await checkRateLimit({ ip, key: "submit-payment", limit: 15, windowMs: 60_000 });
    if (!rate.ok) {
      return NextResponse.json({ error: "RATE_LIMIT", resetAtMs: rate.resetAtMs }, { status: 429 });
    }

    const json = (await req.json()) as unknown;
    const parsed = submitPaymentSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
    }

    const { publicCode, trackingToken, operationCode, method } = parsed.data;
    const now = Timestamp.now();

    const opRef = adminDb.collection("paymentOps").doc(operationCode);

    const result = await adminDb.runTransaction(async (tx) => {
      const opSnap = await tx.get(opRef);
      if (opSnap.exists) {
        const data = opSnap.data() as { orderPublicCode?: string; orderId?: string };
        if (data?.orderPublicCode === publicCode) {
          // Idempotent repeat: return success
          return { ok: true as const, idempotent: true as const };
        }
        throw new Error("OPERATION_CODE_ALREADY_USED");
      }

      // Find order by publicCode
      const q = adminDb.collection("orders").where("publicCode", "==", publicCode).limit(1);
      const qs = await tx.get(q);
      if (qs.empty) throw new Error("ORDER_NOT_FOUND");
      const orderSnap = qs.docs[0]!;
      const order = orderSnap.data() as any;

      if (order.trackingToken !== trackingToken) {
        throw new Error("INVALID_TRACKING_TOKEN");
      }

      const status = order.status as string;
      const decision = decidePaymentSubmission(status, order.payment?.operationCode, operationCode);
      if (decision === "ORDER_CANCELLED") throw new Error("ORDER_CANCELLED");
      if (decision === "ORDER_ALREADY_FINAL") throw new Error("ORDER_ALREADY_FINAL");
      if (decision === "PAYMENT_ALREADY_SENT") throw new Error("PAYMENT_ALREADY_SENT");
      if (decision === "IDEMPOTENT") {
        return { ok: true as const, idempotent: true as const };
      }

      // Expired check (best effort)
      const reservedUntil = order.reservedUntil as FirebaseFirestore.Timestamp | undefined;
      if (reservedUntil && reservedUntil.toMillis() < now.toMillis()) {
        throw new Error("ORDER_EXPIRED");
      }

      tx.set(opRef, {
        orderId: orderSnap.id,
        orderPublicCode: publicCode,
        createdAt: new Date(),
      });

      tx.update(orderSnap.ref, {
        status: "PAYMENT_SENT",
        "payment.operationCode": operationCode,
        "payment.method": method,
        "payment.paymentSentAt": now,
        updatedAt: now,
      });

      // audit log
      const auditRef = adminDb.collection("auditLogs").doc();
      tx.set(auditRef, {
        actor: { uid: "public", email: order.customer?.email ?? "unknown" },
        action: "PAYMENT_SUBMITTED",
        target: { type: "order", id: orderSnap.id, publicCode },
        before: { status },
        after: { status: "PAYMENT_SENT", operationCode, method },
        meta: { ip, userAgent: ua },
        createdAt: new Date(),
      });

      return {
        ok: true as const,
        idempotent: false as const,
        orderId: orderSnap.id,
        customerEmail: order.customer?.email as string | undefined,
        customerName: order.customer?.name as string | undefined,
        customerPhone: order.customer?.phone as string | undefined,
        publicCode,
      };
    });

    // Email (best effort)
    const email = (result as any).customerEmail as string | undefined;
    if (email) {
      const mailRes = await sendTransactionalEmail({
        to: email,
        subject: `ODERA 05 STORE - Pago reportado (${publicCode})`,
        text:
          `Recibimos tu reporte de pago.\n\n` +
          `Pedido: ${publicCode}\n` +
          `Nombre: ${(result as any).customerName ?? "-"}\n` +
          `Telefono: ${(result as any).customerPhone ?? "-"}\n` +
          `Operacion: ${operationCode}\n` +
          `Metodo: ${method}\n\n` +
          `Estado actual: Pendiente de validacion de pago\n` +
          `Te notificaremos cuando se confirme.`,
      });

      try {
        const orderId = (result as any).orderId as string | undefined;
        if (orderId) {
          await adminDb.collection("orders").doc(orderId).set(
            {
              notifications: {
                paymentSubmitted: {
                  customerEmail: mailRes,
                  sentAt: Timestamp.now(),
                },
              },
            },
            { merge: true }
          );
        }
      } catch (mailLogErr) {
        const m = mailLogErr instanceof Error ? mailLogErr.message : String(mailLogErr);
        console.error("[submit-payment] mail log save failed", m);
      }
    }

    return NextResponse.json({ ok: true, idempotent: (result as any).idempotent ?? false }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[submit-payment] error", msg);

    const statusMap: Record<string, number> = {
      ORDER_NOT_FOUND: 404,
      INVALID_TRACKING_TOKEN: 403,
      OPERATION_CODE_ALREADY_USED: 409,
      ORDER_EXPIRED: 410,
      PAYMENT_ALREADY_SENT: 409,
      ORDER_CANCELLED: 409,
      ORDER_ALREADY_FINAL: 409,
    };

    return NextResponse.json({ error: msg }, { status: statusMap[msg] ?? 500 });
  }
}

