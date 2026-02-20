import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { adminUpdateOrderStatusSchema } from "@/schemas/adminOrders";
import { assertCsrfHeader } from "@/lib/server/csrf";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";
import { getRequestIp, getUserAgent } from "@/lib/server/ip";
import { sendTransactionalEmail } from "@/lib/server/email";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    assertCsrfHeader(req);

    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    const admin = await verifyAdminSessionCookie(sessionCookie);

    const json = (await req.json()) as unknown;
    const parsed = adminUpdateOrderStatusSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
    }

    const { orderId, nextStatus } = parsed.data;

    const ip = getRequestIp(req);
    const ua = getUserAgent(req);
    const now = Timestamp.now();

    const orderRef = adminDb.collection("orders").doc(orderId);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error("ORDER_NOT_FOUND");

      const before = snap.data() as any;
      const currentStatus = before.status as string;

      // Basic validation of transitions
      const terminal = ["DELIVERED", "CANCELLED", "CANCELLED_EXPIRED"];
      if (terminal.includes(currentStatus) && nextStatus !== currentStatus) {
        throw new Error("ORDER_ALREADY_TERMINAL");
      }

      // Cancel logic (restock only if before PAID)
      if (nextStatus === "CANCELLED") {
        if (currentStatus === "PAID" || currentStatus === "SHIPPED" || currentStatus === "DELIVERED") {
          throw new Error("CANNOT_CANCEL_AFTER_PAID");
        }

        const items = Array.isArray(before.itemsSnapshots) ? before.itemsSnapshots : [];
        for (const it of items) {
          const productId = it.productId as string;
          const variantId = it.variantSnapshot?.id as string;
          const qty = it.qty as number;

          if (!productId || !variantId || !Number.isFinite(qty)) continue;

          const productRef = adminDb.collection("products").doc(productId);
          const pSnap = await tx.get(productRef);
          if (!pSnap.exists) continue;

          const p = pSnap.data() as any;
          const variants = Array.isArray(p.variants) ? [...p.variants] : [];
          const idx = variants.findIndex((v) => v.id === variantId);
          if (idx >= 0) {
            const v = variants[idx]!;
            variants[idx] = { ...v, stock: (v.stock as number) + qty };
            tx.update(productRef, { variants, updatedAt: now });
          }

          const stockLogRef = adminDb.collection("stockLogs").doc();
          tx.set(stockLogRef, {
            productId,
            variantId,
            delta: qty,
            reason: "RELEASE",
            orderId,
            createdAt: new Date(),
          });
        }

        tx.update(orderRef, { status: "CANCELLED", updatedAt: now });
      } else {
        tx.update(orderRef, { status: nextStatus, updatedAt: now });
      }

      const after = { ...before, status: nextStatus };

      const auditRef = adminDb.collection("auditLogs").doc();
      tx.set(auditRef, {
        actor: { uid: admin.uid, email: admin.email },
        action: "ORDER_STATUS_UPDATE",
        target: { type: "order", id: orderId, publicCode: before.publicCode },
        before: { status: currentStatus },
        after: { status: nextStatus },
        meta: { ip, userAgent: ua },
        createdAt: new Date(),
      });

      return {
        customerEmail: before.customer?.email as string | undefined,
        publicCode: before.publicCode as string | undefined,
      };
    });

    // Email (best effort)
    if (result.customerEmail && result.publicCode) {
      await sendTransactionalEmail({
        to: result.customerEmail,
        subject: `ODERA 05 STORE — Estado actualizado (${result.publicCode})`,
        text: `Tu pedido ${result.publicCode} cambió a estado: ${nextStatus}`,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[admin/orders/update-status] error", msg);

    const codeToStatus: Record<string, number> = {
      ORDER_NOT_FOUND: 404,
      ORDER_ALREADY_TERMINAL: 409,
      CANNOT_CANCEL_AFTER_PAID: 409,
      CSRF_FAILED: 403,
      NOT_ADMIN: 403,
      AUTH_TOO_OLD: 401,
    };
    return NextResponse.json({ error: msg }, { status: codeToStatus[msg] ?? 500 });
  }
}
