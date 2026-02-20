import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { productUpsertSchema } from "@/schemas/product";
import { assertCsrfHeader } from "@/lib/server/csrf";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";
import { getRequestIp, getUserAgent } from "@/lib/server/ip";
import { makeProductSearchTokens } from "@/lib/searchTokens";
import { assertImageUrlAllowed } from "@/lib/server/storageAdapter";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    assertCsrfHeader(req);

    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

    const admin = await verifyAdminSessionCookie(sessionCookie);

    const json = (await req.json()) as unknown;
    const parsed = productUpsertSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });
    }

    const input = parsed.data;

    // Validate image URLs based on storage mode.
    for (const img of input.images) {
      assertImageUrlAllowed(img.url);
    }

    const ip = getRequestIp(req);
    const ua = getUserAgent(req);

    const now = Timestamp.now();
    const productRef = adminDb.collection("products").doc(input.slug);

    const searchTokens = makeProductSearchTokens({
      slug: input.slug,
      name: input.name,
      description: input.description,
      brand: input.brand,
      category: input.category,
    });

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(productRef);
      const exists = snap.exists;

      const doc = {
        ...input,
        searchTokens,
        slug: input.slug,
        updatedAt: now,
        createdAt: exists ? snap.data()?.createdAt ?? now : now,
      };

      tx.set(productRef, doc, { merge: true });

      const auditRef = adminDb.collection("auditLogs").doc();
      tx.set(auditRef, {
        actor: { uid: admin.uid, email: admin.email },
        action: exists ? "PRODUCT_UPDATED" : "PRODUCT_CREATED",
        target: { type: "product", id: productRef.id },
        before: exists ? { ...snap.data() } : null,
        after: doc,
        meta: { ip, userAgent: ua },
        createdAt: new Date(),
      });
    });

    return NextResponse.json({ ok: true, productId: input.slug }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    console.error("[admin/products/upsert] error", msg);
    return NextResponse.json({ error: msg }, { status: msg === "CSRF_FAILED" ? 403 : 500 });
  }
}
