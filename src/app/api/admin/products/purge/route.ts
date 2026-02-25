import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { assertCsrfHeader } from "@/lib/server/csrf";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";
import { getRequestIp, getUserAgent } from "@/lib/server/ip";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  productId: z.string().min(2),
});

export async function POST(req: Request) {
  try {
    assertCsrfHeader(req);
    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const admin = await verifyAdminSessionCookie(sessionCookie);

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });

    const now = Timestamp.now();
    const ip = getRequestIp(req);
    const ua = getUserAgent(req);
    const ref = adminDb.collection("products").doc(parsed.data.productId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("PRODUCT_NOT_FOUND");
      const before = snap.data() as any;
      if (!before?.deletedAt) throw new Error("PRODUCT_PURGE_REQUIRES_TRASH");

      tx.delete(ref);
      const auditRef = adminDb.collection("auditLogs").doc();
      tx.set(auditRef, {
        actor: { uid: admin.uid, email: admin.email },
        action: "PRODUCT_PURGED",
        target: { type: "product", id: parsed.data.productId },
        before: { slug: before?.slug ?? "", status: before?.status ?? "", deletedAt: before?.deletedAt ?? null },
        after: null,
        meta: { ip, userAgent: ua },
        createdAt: now,
      });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    const codeToStatus: Record<string, number> = {
      CSRF_FAILED: 403,
      NOT_ADMIN: 403,
      AUTH_TOO_OLD: 401,
      PRODUCT_NOT_FOUND: 404,
      PRODUCT_PURGE_REQUIRES_TRASH: 409,
    };
    return NextResponse.json({ error: msg }, { status: codeToStatus[msg] ?? 500 });
  }
}

