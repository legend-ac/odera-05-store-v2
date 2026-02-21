import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { createHash } from "crypto";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { createOrderSchema } from "@/schemas/createOrder";
import { verifyAppCheckIfEnabled } from "@/lib/server/appCheckVerify";
import { getRequestIp, getUserAgent } from "@/lib/server/ip";
import { checkRateLimit } from "@/lib/server/rateLimit";
import { randomToken } from "@/lib/server/random";
import { sendTransactionalEmail } from "@/lib/server/email";
import { getServerEnv } from "@/lib/env";
import type { ProductDoc } from "@/types/firestore";

export const runtime = "nodejs";
export const maxDuration = 60;

type ProductRefData = ProductDoc & { variants: { id: string; size?: string; color?: string; sku?: string; stock: number }[] };

function pickUnitPrice(p: ProductRefData): number {
  if (p.onSale && typeof p.salePrice === "number") return p.salePrice;
  return p.price;
}

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

function escapeHtml(v: string): string {
  return v
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toHtmlLines(v: string): string {
  return escapeHtml(v).replaceAll("\n", "<br/>");
}

export async function POST(req: Request) {
  try {
    await verifyAppCheckIfEnabled(req);

    const ip = getRequestIp(req);
    const ua = getUserAgent(req);

    const rate = await checkRateLimit({ ip, key: "create-order", limit: 20, windowMs: 60_000 });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "RATE_LIMIT", resetAtMs: rate.resetAtMs },
        { status: 429, headers: { "retry-after": String(Math.ceil((rate.resetAtMs - Date.now()) / 1000)) } }
      );
    }

    const idempotencyKey = req.headers.get("x-idempotency-key");
    const idemRef = idempotencyKey
      ? adminDb.collection("orderOps").doc(createHash("sha256").update(`${ip}:${idempotencyKey}`).digest("hex").slice(0, 32))
      : null;

    const json = (await req.json()) as unknown;
    const parsed = createOrderSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
    }

    const { items, customer, payment, shipping, couponCode } = parsed.data;

    const merged = new Map<string, { productId: string; variantId: string; qty: number }>();
    for (const it of items) {
      const key = `${it.productId}::${it.variantId}`;
      const prev = merged.get(key);
      merged.set(key, {
        productId: it.productId,
        variantId: it.variantId,
        qty: Math.min(50, (prev?.qty ?? 0) + it.qty),
      });
    }
    const normItems = Array.from(merged.values());

    const now = Timestamp.now();
    const reservedUntil = Timestamp.fromMillis(now.toMillis() + 20 * 60 * 1000);

    const orderRef = adminDb.collection("orders").doc();
    const counterRef = adminDb.collection("counters").doc("orders");

    const trackingToken = randomToken(18);

    const result = await adminDb.runTransaction(async (tx) => {
      if (idemRef) {
        const idemSnap = await tx.get(idemRef);
        if (idemSnap.exists) {
          const data = idemSnap.data() as any;
          return {
            orderId: data.orderId as string,
            publicCode: data.publicCode as string,
            trackingToken: data.trackingToken as string,
            reservedUntilMs: data.reservedUntilMs as number,
            shippingCost: (data.shippingCost as number | undefined) ?? 0,
            totalToPay: data.totalToPay as number | undefined,
            idempotent: true as const,
          };
        }
      }

      const productSnaps: { productId: string; snap: FirebaseFirestore.DocumentSnapshot }[] = [];
      for (const it of normItems) {
        const ref = adminDb.collection("products").doc(it.productId);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error(`PRODUCT_NOT_FOUND:${it.productId}`);
        productSnaps.push({ productId: it.productId, snap });
      }

      const counterSnap = await tx.get(counterRef);
      const prevSeq = counterSnap.exists ? (counterSnap.data()?.seq as number | undefined) ?? 0 : 0;
      const seq = prevSeq + 1;
      tx.set(counterRef, { seq }, { merge: true });

      const publicCode = `OD-${String(seq).padStart(4, "0")}`;

      const itemsSnapshots = [];
      let subtotal = 0;

      for (const it of normItems) {
        const productSnap = productSnaps.find((x) => x.productId === it.productId)!.snap;
        const product = productSnap.data() as ProductRefData;

        if (product.status !== "active") {
          throw new Error(`PRODUCT_INACTIVE:${it.productId}`);
        }

        const variants = Array.isArray(product.variants) ? [...product.variants] : [];
        const vIdx = variants.findIndex((v) => v.id === it.variantId);
        if (vIdx < 0) throw new Error(`VARIANT_NOT_FOUND:${it.productId}:${it.variantId}`);
        const variant = variants[vIdx]!;
        if (variant.stock < it.qty) throw new Error(`OUT_OF_STOCK:${it.productId}:${it.variantId}`);

        variants[vIdx] = { ...variant, stock: variant.stock - it.qty };

        const unitPrice = pickUnitPrice(product);
        subtotal += unitPrice * it.qty;

        const mainImg =
          (Array.isArray(product.images) ? product.images : []).find((img) => img.isMain)?.url ??
          (Array.isArray(product.images) ? product.images : [])[0]?.url ??
          "";

        itemsSnapshots.push({
          productId: it.productId,
          nameSnapshot: product.name,
          imageSnapshot: mainImg,
          variantSnapshot: { id: variant.id, size: variant.size, color: variant.color },
          unitPriceSnapshot: unitPrice,
          qty: it.qty,
        });

        tx.update(productSnap.ref, { variants, updatedAt: now });

        const stockLogRef = adminDb.collection("stockLogs").doc();
        tx.set(stockLogRef, {
          productId: it.productId,
          variantId: it.variantId,
          delta: -it.qty,
          reason: "RESERVE",
          orderId: orderRef.id,
          createdAt: new Date(),
        });
      }

      const normalizedCoupon = (couponCode ?? "").trim().toUpperCase();
      const isCouponValid = normalizedCoupon === "ODERA10";
      const discountAmount = isCouponValid ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
      const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
      const shippingCost = subtotal >= 200 ? 0 : 10;
      const totalToPay = subtotalAfterDiscount + shippingCost;

      const orderDoc = {
        publicCode,
        trackingToken,
        status: "PENDING_VALIDATION",
        reservedUntil,
        customer,
        shipping,
        itemsSnapshots,
        couponCode: isCouponValid ? normalizedCoupon : undefined,
        totals: { subtotal, discountAmount, shippingCost, totalToPay },
        payment: {
          method: payment.method,
          receiptImageUrl: payment.receiptImageUrl,
          paymentSentAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };

      tx.set(orderRef, orderDoc);

      const auditRef = adminDb.collection("auditLogs").doc();
      tx.set(auditRef, {
        actor: { uid: "public", email: customer.email },
        action: "ORDER_CREATED",
        target: { type: "order", id: orderRef.id, publicCode },
        before: null,
        after: { status: "PENDING_VALIDATION" },
        meta: { ip, userAgent: ua, shippingMethod: shipping.method },
        createdAt: new Date(),
      });

      const payload = {
        orderId: orderRef.id,
        publicCode,
        trackingToken,
        reservedUntilMs: reservedUntil.toMillis(),
        itemsSnapshots,
        discountAmount,
        shippingCost,
        totalToPay,
        idempotent: false as const,
      };

      if (idemRef) {
        tx.set(
          idemRef,
          {
            orderId: orderRef.id,
            publicCode,
            trackingToken,
            reservedUntilMs: reservedUntil.toMillis(),
            discountAmount,
            shippingCost,
            totalToPay,
            ip,
            createdAt: new Date(),
          },
          { merge: true }
        );
      }

      return payload;
    });

    const wasIdempotent = (result as any).idempotent === true;

    const settingsSnap = await adminDb.doc("settings/store").get();
    const storeName = settingsSnap.exists ? (settingsSnap.data()?.storeName as string | undefined) : undefined;
    const env = getServerEnv();
    const businessEmail = (settingsSnap.exists ? (settingsSnap.data()?.publicContactEmail as string | undefined) : undefined) || env.SMTP_USER;
    const origin = new URL(req.url).origin;
    const trackingUrl = `${origin}/track?publicCode=${encodeURIComponent(result.publicCode)}&trackingToken=${encodeURIComponent(result.trackingToken)}`;

    const orderLines = ((result as any).itemsSnapshots ?? [])
      .map((it: any) => `- ${it.nameSnapshot} x ${it.qty} - S/ ${(Number(it.unitPriceSnapshot ?? 0) * Number(it.qty ?? 0)).toFixed(2)}`)
      .join("\n");

    const mailDetail =
      `Pedido: ${result.publicCode}\n` +
      `Estado: Pendiente de validacion de pago\n\n` +
      `Cliente\n` +
      `Nombre: ${customer.name}\n` +
      `Correo: ${customer.email}\n` +
      `Telefono: ${customer.phone}\n\n` +
      `${shippingToText(shipping)}\n\n` +
      `Metodo de pago: ${payment.method}\n` +
      `Comprobante: ${payment.receiptImageUrl}\n\n` +
      `Productos:\n${orderLines}\n\n` +
      `Descuento: S/ ${((result as any).discountAmount ?? 0).toFixed(2)}\n` +
      `Envio: S/ ${((result as any).shippingCost ?? 0).toFixed(2)}\n` +
      `Total: S/ ${((result as any).totalToPay ?? 0).toFixed(2)}\n\n` +
      `Clave de seguimiento: ${result.trackingToken}\n` +
      `Enlace de seguimiento: ${trackingUrl}`;

    const logoUrl = env.EMAIL_BRAND_IMAGE_URL;
    const customerHtml =
      `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:20px">` +
      `<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">` +
      `${logoUrl ? `<div style="background:#0f172a;padding:16px;text-align:center"><img src="${escapeHtml(logoUrl)}" alt="ODERA 05" style="max-height:120px;max-width:100%;border-radius:10px"/></div>` : ""}` +
      `<div style="padding:18px 20px">` +
      `<h2 style="margin:0 0 10px;color:#0f172a">Pedido ${escapeHtml(result.publicCode)}</h2>` +
      `<p style="margin:0 0 14px;color:#334155">Tu pedido fue registrado correctamente. Estado: <b>Pendiente de validacion de pago</b>.</p>` +
      `<div style="font-size:14px;line-height:1.55;color:#111827">${toHtmlLines(mailDetail)}</div>` +
      `</div></div></div>`;

    const businessHtml =
      `<div style="font-family:Arial,sans-serif;background:#f5f7fb;padding:20px">` +
      `<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">` +
      `${logoUrl ? `<div style="background:#0f172a;padding:16px;text-align:center"><img src="${escapeHtml(logoUrl)}" alt="ODERA 05" style="max-height:120px;max-width:100%;border-radius:10px"/></div>` : ""}` +
      `<div style="padding:18px 20px">` +
      `<h2 style="margin:0 0 10px;color:#0f172a">Nuevo pedido ${escapeHtml(result.publicCode)}</h2>` +
      `<div style="font-size:14px;line-height:1.55;color:#111827">${toHtmlLines(mailDetail)}</div>` +
      `</div></div></div>`;

    if (!wasIdempotent) {
      const customerMail = await sendTransactionalEmail({
        to: customer.email,
        subject: `${storeName ?? "ODERA 05 STORE"} - Pedido ${result.publicCode} (Pendiente de validacion)`,
        text: `Tu pedido fue registrado correctamente.\n\n${mailDetail}`,
        html: customerHtml,
      });

      let businessMail: { ok: true } | { ok: false; error: string } = { ok: true };
      if (businessEmail) {
        businessMail = await sendTransactionalEmail({
          to: businessEmail,
          subject: `Nuevo pedido ${result.publicCode} - ${storeName ?? "ODERA 05 STORE"}`,
          text: mailDetail,
          html: businessHtml,
        });
      }

      try {
        await adminDb.collection("orders").doc((result as any).orderId).set(
          {
            notifications: {
              orderCreated: {
                customerEmail: customerMail,
                businessEmail: businessMail,
                sentAt: Timestamp.now(),
              },
            },
          },
          { merge: true }
        );
      } catch (mailLogErr) {
        const m = mailLogErr instanceof Error ? mailLogErr.message : String(mailLogErr);
        console.error("[create-order] mail log save failed", m);
      }

      if (!customerMail.ok) {
        console.error("[create-order] customer email failed", customerMail.error);
      }
      if (businessEmail && !businessMail.ok) {
        console.error("[create-order] business email failed", businessMail.error);
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[create-order] error", msg);

    if (typeof msg === "string" && msg.startsWith("OUT_OF_STOCK")) {
      return NextResponse.json({ error: "OUT_OF_STOCK", detail: msg }, { status: 409 });
    }
    if (typeof msg === "string" && msg.startsWith("PRODUCT_NOT_FOUND")) {
      return NextResponse.json({ error: "PRODUCT_NOT_FOUND", detail: msg }, { status: 404 });
    }
    if (typeof msg === "string" && msg.startsWith("PRODUCT_INACTIVE")) {
      return NextResponse.json({ error: "PRODUCT_INACTIVE", detail: msg }, { status: 409 });
    }
    if (typeof msg === "string" && msg.startsWith("VARIANT_NOT_FOUND")) {
      return NextResponse.json({ error: "VARIANT_NOT_FOUND", detail: msg }, { status: 404 });
    }
    return NextResponse.json({ error: "SERVER_ERROR", detail: msg }, { status: 500 });
  }
}
