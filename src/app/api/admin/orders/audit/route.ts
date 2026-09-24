import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { assertCsrfHeader } from "@/lib/server/csrf";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ orderId: z.string().min(1) });

function fmtDate(value: any): string {
  try {
    if (value?.toDate) return value.toDate().toLocaleString("es-PE");
    if (value instanceof Date) return value.toLocaleString("es-PE");
  } catch {}
  return "";
}

export async function POST(req: Request) {
  try {
    assertCsrfHeader(req);

    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    await verifyAdminSessionCookie(sessionCookie);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

    const snap = await adminDb
      .collection("auditLogs")
      .where("target.id", "==", parsed.data.orderId)
      .limit(20)
      .get();

    const logs = snap.docs
      .map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        targetType: String(data.target?.type ?? ""),
        action: String(data.action ?? ""),
        actor: String(data.actor?.email ?? data.actor?.uid ?? ""),
        createdAt: fmtDate(data.createdAt),
        createdAtMs: typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : 0,
        beforeStatus: String(data.before?.status ?? ""),
        afterStatus: String(data.after?.status ?? ""),
      };
      })
      .filter((log) => log.targetType === "order")
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .map(({ targetType, createdAtMs, ...log }) => log);

    return NextResponse.json({ ok: true, logs }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[admin/orders/audit] error", msg);
    return NextResponse.json({ error: msg }, { status: msg === "CSRF_FAILED" ? 403 : 500 });
  }
}
