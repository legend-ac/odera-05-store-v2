export const runtime = "nodejs";
export const maxDuration = 60;

import { adminDb } from "@/lib/server/firebaseAdmin";
import OrdersClient from "./orders-client";

function toMs(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return null;
}

export default async function OrdersPage() {
  let snap: any = null;
  try {
    snap = await adminDb.collection("orders").orderBy("createdAt", "desc").limit(50).get();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("NOT_FOUND")) throw e;
  }

  const orders = (snap?.docs ?? []).map((d: any) => {
    const data = d.data() as any;
    return {
      id: d.id,
      publicCode: data.publicCode as string,
      status: data.status as string,
      customerName: (data.customer?.name as string | undefined) ?? "",
      email: (data.customer?.email as string | undefined) ?? "",
      phone: (data.customer?.phone as string | undefined) ?? "",
      totalToPay: (data.totals?.totalToPay as number | undefined) ?? 0,
      paymentMethod: (data.payment?.method as string | undefined) ?? "",
      receiptImageUrl: (data.payment?.receiptImageUrl as string | undefined) ?? "",
      shipping: data.shipping ?? null,
      reservedUntilMs: toMs(data.reservedUntil),
      createdAtMs: toMs(data.createdAt),
    };
  });

  return <OrdersClient initialOrders={orders} />;
}
