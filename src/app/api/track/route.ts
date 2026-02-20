import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { trackOrderSchema } from "@/schemas/trackOrder";
import { verifyAppCheckIfEnabled } from "@/lib/server/appCheckVerify";
import { getRequestIp } from "@/lib/server/ip";
import { checkRateLimit } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

function tsToMillis(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return null;
}

export async function POST(req: Request) {
  try {
    await verifyAppCheckIfEnabled(req);

    const ip = getRequestIp(req);
    const rate = await checkRateLimit({ ip, key: "track", limit: 30, windowMs: 60_000 });
    if (!rate.ok) return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });

    const json = (await req.json()) as unknown;
    const parsed = trackOrderSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
    }

    const { publicCode, trackingToken } = parsed.data;

    const q = adminDb.collection("orders").where("publicCode", "==", publicCode).limit(1);
    const qs = await q.get();
    if (qs.empty) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });

    const doc = qs.docs[0]!;
    const data = doc.data() as any;
    if (data.trackingToken !== trackingToken) {
      return NextResponse.json({ error: "INVALID_TRACKING_TOKEN" }, { status: 403 });
    }

    return NextResponse.json(
      {
        orderId: doc.id,
        publicCode: data.publicCode,
        status: data.status,
        customer: data.customer ?? null,
        reservedUntilMs: tsToMillis(data.reservedUntil),
        itemsSnapshots: data.itemsSnapshots ?? [],
        totals: data.totals ?? null,
        couponCode: data.couponCode ?? null,
        shipping: data.shipping ?? null,
        payment: data.payment ?? {},
        createdAtMs: tsToMillis(data.createdAt),
        updatedAtMs: tsToMillis(data.updatedAt),
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[track] error", msg);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
