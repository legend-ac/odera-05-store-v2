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
import type { ProductDoc } from "@/types/firestore";

export const runtime = "nodejs";
export const maxDuration = 60;

type ProductRefData = ProductDoc & { variants: { id: string; size?: string; color?: string; sku?: string; stock: number }[] };

function pickUnitPrice(p: ProductRefData): number {
  if (p.onSale && typeof p.salePrice === "number") return p.salePrice;
  return p.price;
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

    const { items, customer, shipping, couponCode } = parsed.data;

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
        status: "SCHEDULED",
        reservedUntil,
        customer,
        shipping,
        itemsSnapshots,
        couponCode: isCouponValid ? normalizedCoupon : undefined,
        totals: { subtotal, discountAmount, shippingCost, totalToPay },
        payment: {},
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
        after: { status: "SCHEDULED" },
        meta: { ip, userAgent: ua, shippingMethod: shipping.method },
        createdAt: new Date(),
      });

      const payload = {
        orderId: orderRef.id,
        publicCode,
        trackingToken,
        reservedUntilMs: reservedUntil.toMillis(),
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

    if (!wasIdempotent) {
      await sendTransactionalEmail({
        to: customer.email,
        subject: `${storeName ?? "ODERA 05 STORE"} - Pedido ${result.publicCode}`,
        text:
          `Tu pedido fue creado.\n\n` +
          `Codigo: ${result.publicCode}\n` +
          `Clave de seguimiento: ${result.trackingToken}\n` +
          `Reserva valida hasta: ${new Date(result.reservedUntilMs).toLocaleString("es-PE")}\n` +
          `Descuento: S/ ${(result as any).discountAmount ?? 0}\n` +
          `Costo de envio: S/ ${result.shippingCost}\n` +
          `Total a pagar: S/ ${result.totalToPay}\n\n` +
          `Puedes enviar tu pago desde la seccion Mis pedidos del sitio.`,
      });
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
    return NextResponse.json({ error: "SERVER_ERROR", detail: msg }, { status: 500 });
  }
}
