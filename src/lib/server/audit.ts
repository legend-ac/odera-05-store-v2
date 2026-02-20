import "server-only";

import { adminDb } from "@/lib/server/firebaseAdmin";
import type { DocumentReference } from "firebase-admin/firestore";

export type AuditActor = { uid: string; email: string };
export type AuditTarget = { type: "order" | "product" | "settings"; id: string; publicCode?: string };

export async function writeAuditLog(params: {
  actor: AuditActor;
  action: string;
  target: AuditTarget;
  before: unknown;
  after: unknown;
  meta: { ip: string; userAgent: string };
}): Promise<DocumentReference> {
  const ref = adminDb.collection("auditLogs").doc();
  await ref.set({
    actor: params.actor,
    action: params.action,
    target: params.target,
    before: params.before ?? null,
    after: params.after ?? null,
    meta: params.meta,
    createdAt: new Date(),
  });
  return ref;
}

export async function writeStockLog(params: {
  productId: string;
  variantId: string;
  delta: number;
  reason: "RESERVE" | "RELEASE" | "MANUAL_ADJUST" | "CANCEL";
  orderId?: string;
}): Promise<void> {
  const ref = adminDb.collection("stockLogs").doc();
  await ref.set({
    productId: params.productId,
    variantId: params.variantId,
    delta: params.delta,
    reason: params.reason,
    orderId: params.orderId ?? null,
    createdAt: new Date(),
  });
}
