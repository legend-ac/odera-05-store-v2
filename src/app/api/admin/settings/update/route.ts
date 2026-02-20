import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { storeSettingsSchema } from "@/schemas/settings";
import { assertCsrfHeader } from "@/lib/server/csrf";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";
import { getRequestIp, getUserAgent } from "@/lib/server/ip";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    assertCsrfHeader(req);

    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    const admin = await verifyAdminSessionCookie(sessionCookie);

    const json = (await req.json()) as unknown;
    const parsed = storeSettingsSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
    }

    const ip = getRequestIp(req);
    const ua = getUserAgent(req);

    const now = Timestamp.now();
    const ref = adminDb.doc("settings/store");

    const beforeSnap = await ref.get();
    const before = beforeSnap.exists ? beforeSnap.data() : null;

    await ref.set({ ...parsed.data, updatedAt: now }, { merge: true });

    await adminDb.collection("auditLogs").add({
      actor: { uid: admin.uid, email: admin.email },
      action: "SETTINGS_UPDATED",
      target: { type: "settings", id: "store" },
      before,
      after: parsed.data,
      meta: { ip, userAgent: ua },
      createdAt: new Date(),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[admin/settings/update] error", msg);
    return NextResponse.json({ error: msg }, { status: msg === "CSRF_FAILED" ? 403 : 500 });
  }
}
