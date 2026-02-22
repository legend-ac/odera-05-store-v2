import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { adminUpdateOrderStatusSchema } from "@/schemas/adminOrders";
import { assertCsrfHeader } from "@/lib/server/csrf";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";
import { getRequestIp, getUserAgent } from "@/lib/server/ip";
import { sendTransactionalEmail } from "@/lib/server/email";
import { ALLOWED_NEXT, isOrderStatus } from "@/lib/orderStatus";
import { renderOrderEmail } from "@/lib/server/emailTemplates";
import { formatPEN } from "@/lib/money";

export const runtime = "nodejs";
export const maxDuration = 60;

function shippingToText(shipping: any): string {
  if (!shipping) return "-";
  if (shipping.method === "LIMA_DELIVERY") {
    return [
      "Tipo de envio: Delivery Lima Metropolitana",
      `Recibe: ${shipping.receiverName}`,
      `DNI: ${shipping.receiverDni}`,
      `Telefono: ${shipping.receiverPhone}`,
      `Distrito: ${shipping.district}`,
      `Direccion: ${shipping.addressLine1}`,
      shipping.reference ? `Referencia: ${shipping.reference}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "Tipo de envio: Agencia provincia",
    `Recoge: ${shipping.receiverName}`,
    `DNI: ${shipping.receiverDni}`,
    `Telefono: ${shipping.receiverPhone}`,
    `Departamento: ${shipping.department}`,
    `Provincia: ${shipping.province}`,
    `Agencia: ${shipping.agencyName}`,
    `Direccion agencia: ${shipping.agencyAddress}`,
    shipping.reference ? `Referencia: ${shipping.reference}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function statusToText(status: string): string {
  const map: Record<string, string> = {
    PENDING_VALIDATION: "Pendiente de validacion de pago",
    PAYMENT_SENT: "Pendiente de validacion de pago",
    PAID: "Pagado",
    SHIPPED: "Enviado",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
    CANCELLED_EXPIRED: "Cancelado por vencimiento",
  };
  return map[status] ?? status;
}

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

      const terminal = ["DELIVERED", "CANCELLED", "CANCELLED_EXPIRED"];
      if (terminal.includes(currentStatus) && nextStatus !== currentStatus) {
        throw new Error("ORDER_ALREADY_TERMINAL");
      }

      if (nextStatus !== currentStatus) {
        if (!isOrderStatus(currentStatus)) {
          throw new Error("INVALID_STATUS_TRANSITION");
        }
        const allowed = ALLOWED_NEXT[currentStatus];
        if (!allowed.includes(nextStatus as any)) {
          throw new Error("INVALID_STATUS_TRANSITION");
        }
      }

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
        trackingToken: before.trackingToken as string | undefined,
        customerName: before.customer?.name as string | undefined,
        customerPhone: before.customer?.phone as string | undefined,
        itemsSnapshots: Array.isArray(before.itemsSnapshots) ? before.itemsSnapshots : [],
        totals: before.totals ?? null,
        shipping: before.shipping ?? null,
        payment: before.payment ?? {},
      };
    });

    if (result.customerEmail && result.publicCode) {
      const origin = new URL(req.url).origin;
      const trackingUrl =
        result.trackingToken
          ? `${origin}/t/${encodeURIComponent(result.publicCode)}/${encodeURIComponent(result.trackingToken)}`
          : `${origin}/track?publicCode=${encodeURIComponent(result.publicCode)}`;

      const lines = (result.itemsSnapshots ?? [])
        .map((it: any) => `- ${it.nameSnapshot} x ${it.qty} - S/ ${(Number(it.unitPriceSnapshot ?? 0) * Number(it.qty ?? 0)).toFixed(2)}`)
        .join("\n");
      const totals = result.totals ?? {};
      const lineItems = (result.itemsSnapshots ?? []).map((it: any) => {
        const unit = Number(it.unitPriceSnapshot ?? 0);
        const qty = Number(it.qty ?? 0);
        return {
          name: String(it.nameSnapshot ?? "Producto"),
          qty,
          unitPrice: formatPEN(unit),
          lineTotal: formatPEN(unit * qty),
        };
      });
      const detail =
        `Pedido: ${result.publicCode}\n` +
        `Estado: ${statusToText(nextStatus)}\n\n` +
        `Cliente\n` +
        `Nombre: ${result.customerName ?? "-"}\n` +
        `Correo: ${result.customerEmail}\n` +
        `Telefono: ${result.customerPhone ?? "-"}\n\n` +
        `${shippingToText(result.shipping)}\n\n` +
        `Metodo de pago: ${result.payment?.method ?? "-"}\n\n` +
        `Productos:\n${lines || "-"}\n\n` +
        `Subtotal: S/ ${Number(totals.subtotal ?? 0).toFixed(2)}\n` +
        `Descuento: S/ ${Number(totals.discountAmount ?? 0).toFixed(2)}\n` +
        `Envio: S/ ${Number(totals.shippingCost ?? 0).toFixed(2)}\n` +
        `Total: S/ ${Number(totals.totalToPay ?? 0).toFixed(2)}\n\n` +
        `Enlace de seguimiento: ${trackingUrl}`;

      const html = renderOrderEmail({
        storeName: "ODERA 05 STORE",
        title: `Estado de pedido ${result.publicCode}`,
        publicCode: result.publicCode,
        statusLabel: statusToText(nextStatus),
        customerName: result.customerName ?? "-",
        customerEmail: result.customerEmail,
        customerPhone: result.customerPhone ?? "-",
        items: lineItems,
        subtotal: formatPEN(Number(totals.subtotal ?? 0)),
        discount: formatPEN(Number(totals.discountAmount ?? 0)),
        shipping: formatPEN(Number(totals.shippingCost ?? 0)),
        total: formatPEN(Number(totals.totalToPay ?? 0)),
        paymentMethod: String(result.payment?.method ?? "-"),
        trackingUrl,
        receiptUrl: typeof result.payment?.receiptImageUrl === "string" ? result.payment.receiptImageUrl : undefined,
      });

      const mailRes = await sendTransactionalEmail({
        to: result.customerEmail,
        subject: `ODERA 05 STORE - Estado de pedido ${result.publicCode}: ${statusToText(nextStatus)}`,
        text: detail,
        html,
      });

      try {
        await adminDb.collection("orders").doc(orderId).set(
          {
            notifications: {
              statusUpdates: {
                [String(now.toMillis())]: {
                  nextStatus,
                  customerEmail: mailRes,
                  sentAt: now,
                },
              },
            },
          },
          { merge: true }
        );
      } catch (mailLogErr) {
        const m = mailLogErr instanceof Error ? mailLogErr.message : String(mailLogErr);
        console.error("[admin/orders/update-status] mail log save failed", m);
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[admin/orders/update-status] error", msg);

    const codeToStatus: Record<string, number> = {
      ORDER_NOT_FOUND: 404,
      ORDER_ALREADY_TERMINAL: 409,
      CANNOT_CANCEL_AFTER_PAID: 409,
      INVALID_STATUS_TRANSITION: 409,
      CSRF_FAILED: 403,
      NOT_ADMIN: 403,
      AUTH_TOO_OLD: 401,
    };
    return NextResponse.json({ error: msg }, { status: codeToStatus[msg] ?? 500 });
  }
}
