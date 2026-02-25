import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { getServerEnv } from "@/lib/env";
import type { OrderStatus } from "@/lib/orderStatus";

export const runtime = "nodejs";
export const maxDuration = 60;

async function processExpiredForStatus(status: Extract<OrderStatus, "SCHEDULED" | "PENDING_VALIDATION" | "PAYMENT_SENT">, now: Timestamp, limit = 50): Promise<number> {
  const q = adminDb.collection("orders").where("status", "==", status).where("reservedUntil", "<", now).limit(limit);
  const qs = await q.get();
  if (qs.empty) return 0;

  let processed = 0;

  for (const doc of qs.docs) {
    const orderRef = doc.ref;
    try {
      await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(orderRef);
        if (!snap.exists) return;

        const data = snap.data() as any;
        if (data.status !== status) return;

        const reservedUntil = data.reservedUntil as FirebaseFirestore.Timestamp | undefined;
        if (!reservedUntil || reservedUntil.toMillis() >= now.toMillis()) return;

        // Restore stock
        const items = Array.isArray(data.itemsSnapshots) ? data.itemsSnapshots : [];
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
            orderId: orderRef.id,
            createdAt: new Date(),
          });
        }

        tx.update(orderRef, { status: "CANCELLED_EXPIRED", updatedAt: now });

        const auditRef = adminDb.collection("auditLogs").doc();
        tx.set(auditRef, {
          actor: { uid: "cron", email: "cron@local" },
          action: "ORDER_EXPIRED_CANCELLED",
          target: { type: "order", id: orderRef.id, publicCode: data.publicCode },
          before: { status },
          after: { status: "CANCELLED_EXPIRED" },
          meta: { ip: "cron", userAgent: "cron" },
          createdAt: new Date(),
        });
      });

      processed += 1;
    } catch (e) {
      console.warn("[cron] failed to process order", doc.id, e);
    }
  }

  return processed;
}

async function autoTrashOldCancelledOrders(now: Timestamp, olderThanDays = 90, limit = 100): Promise<number> {
  const cutoff = Timestamp.fromMillis(now.toMillis() - olderThanDays * 24 * 60 * 60 * 1000);
  const q = adminDb
    .collection("orders")
    .where("status", "in", ["CANCELLED", "CANCELLED_EXPIRED"])
    .where("createdAt", "<", cutoff)
    .limit(limit);
  const qs = await q.get();
  if (qs.empty) return 0;

  const batch = adminDb.batch();
  let count = 0;
  for (const doc of qs.docs) {
    const data = doc.data() as any;
    if (data?.deletedAt) continue;
    batch.update(doc.ref, {
      deletedAt: now,
      deletedBy: { uid: "cron", email: "cron@local" },
      updatedAt: now,
    });
    const auditRef = adminDb.collection("auditLogs").doc();
    batch.set(auditRef, {
      actor: { uid: "cron", email: "cron@local" },
      action: "ORDER_AUTO_TRASHED_OLD_CANCELLED",
      target: { type: "order", id: doc.id, publicCode: data?.publicCode ?? "" },
      before: { status: data?.status ?? "", deletedAt: data?.deletedAt ?? null },
      after: { deletedAt: now },
      meta: { ip: "cron", userAgent: "cron" },
      createdAt: new Date(),
    });
    count += 1;
  }
  if (count > 0) await batch.commit();
  return count;
}

async function autoPurgeTrashOrders(now: Timestamp, olderThanDays = 30, limit = 100): Promise<number> {
  const cutoff = Timestamp.fromMillis(now.toMillis() - olderThanDays * 24 * 60 * 60 * 1000);
  const qs = await adminDb.collection("orders").where("deletedAt", "<", cutoff).limit(limit).get();
  if (qs.empty) return 0;
  const batch = adminDb.batch();
  let count = 0;
  for (const doc of qs.docs) {
    const data = doc.data() as any;
    batch.delete(doc.ref);
    const auditRef = adminDb.collection("auditLogs").doc();
    batch.set(auditRef, {
      actor: { uid: "cron", email: "cron@local" },
      action: "ORDER_AUTO_PURGED_TRASH",
      target: { type: "order", id: doc.id, publicCode: data?.publicCode ?? "" },
      before: { status: data?.status ?? "", deletedAt: data?.deletedAt ?? null },
      after: null,
      meta: { ip: "cron", userAgent: "cron" },
      createdAt: new Date(),
    });
    count += 1;
  }
  if (count > 0) await batch.commit();
  return count;
}

async function autoPurgeTrashProducts(now: Timestamp, olderThanDays = 30, limit = 100): Promise<number> {
  const cutoff = Timestamp.fromMillis(now.toMillis() - olderThanDays * 24 * 60 * 60 * 1000);
  const qs = await adminDb.collection("products").where("deletedAt", "<", cutoff).limit(limit).get();
  if (qs.empty) return 0;
  const batch = adminDb.batch();
  let count = 0;
  for (const doc of qs.docs) {
    const data = doc.data() as any;
    batch.delete(doc.ref);
    const auditRef = adminDb.collection("auditLogs").doc();
    batch.set(auditRef, {
      actor: { uid: "cron", email: "cron@local" },
      action: "PRODUCT_AUTO_PURGED_TRASH",
      target: { type: "product", id: doc.id },
      before: { slug: data?.slug ?? "", deletedAt: data?.deletedAt ?? null },
      after: null,
      meta: { ip: "cron", userAgent: "cron" },
      createdAt: new Date(),
    });
    count += 1;
  }
  if (count > 0) await batch.commit();
  return count;
}

export async function POST(req: Request) {
  try {
    const env = getServerEnv();
    const secret = req.headers.get("x-cron-secret");
    if (!secret || secret !== env.CRON_SECRET) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const now = Timestamp.now();

    const a = await processExpiredForStatus("PENDING_VALIDATION", now, 50);
    const b = await processExpiredForStatus("SCHEDULED", now, 50);
    const c = await processExpiredForStatus("PAYMENT_SENT", now, 50);
    const d = await autoTrashOldCancelledOrders(now, 90, 100);
    const e = await autoPurgeTrashOrders(now, 30, 100);
    const f = await autoPurgeTrashProducts(now, 30, 100);

    return NextResponse.json({ ok: true, processed: a + b + c, autoTrashedOldCancelled: d, autoPurgedOrders: e, autoPurgedProducts: f }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[cron/release-expired] error", msg);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
