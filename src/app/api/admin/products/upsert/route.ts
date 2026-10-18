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
import { deriveStockDrivenStatus, getInventorySummary } from "@/lib/productStock";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    await assertCsrfHeader(req);

    const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
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
    const productRef = adminDb.collection("products").doc(input.productId ?? input.slug);

    const searchTokens = makeProductSearchTokens({
      slug: input.slug,
      name: input.name,
      description: input.description,
      brand: input.brand,
      category: `${input.category} ${input.productType} ${input.audience}`.trim(),
    });

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(productRef);
      const exists = snap.exists;
      const before = exists ? (snap.data() as any) : null;
      if (!input.productId && exists) throw new Error("PRODUCT_ALREADY_EXISTS");
      if (input.productId && !exists) throw new Error("PRODUCT_NOT_FOUND");
      if (before?.deletedAt) throw new Error("PRODUCT_IN_TRASH");
      if (input.productId && before?.slug && before.slug !== input.slug) throw new Error("PRODUCT_SLUG_LOCKED");
      if (input.expectedUpdatedAtMs !== undefined && before?.updatedAt?.toMillis?.() !== input.expectedUpdatedAtMs) {
        throw new Error("PRODUCT_CHANGED");
      }

      // Regla de stock:
      // - Si stock total = 0 => archivado automatico (oculto en cliente).
      // - Si estaba archivado automaticamente y vuelve stock > 0 => reactivar.
      // - Si admin archiva manualmente, se respeta.
      const shouldRespectManualArchive = input.status === "archived" && !before?.autoArchivedByStock;
      const stockDriven = deriveStockDrivenStatus(
        input.status,
        input.variants,
        shouldRespectManualArchive ? false : Boolean(before?.autoArchivedByStock)
      );
      const inventory = getInventorySummary(input.variants);

      const { productId: _productId, expectedUpdatedAtMs: _expectedUpdatedAtMs, ...productData } = input;
      const doc = {
        ...productData,
        status: shouldRespectManualArchive ? "archived" : stockDriven.status,
        autoArchivedByStock: shouldRespectManualArchive ? false : stockDriven.autoArchivedByStock,
        ...inventory,
        inventoryUpdatedAt: now,
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
      return { status: doc.status, autoArchivedByStock: doc.autoArchivedByStock };
    });

    return NextResponse.json({ ok: true, productId: productRef.id, updatedAtMs: now.toMillis(), ...result }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN_ERROR";
    const status = msg === "CSRF_FAILED" || msg === "NOT_ADMIN" ? 403 : msg === "AUTH_TOO_OLD" ? 401 : msg === "PRODUCT_NOT_FOUND" ? 404 :
      ["PRODUCT_ALREADY_EXISTS", "PRODUCT_IN_TRASH", "PRODUCT_SLUG_LOCKED", "PRODUCT_CHANGED"].includes(msg) ? 409 : 500;
    if (status === 500) console.error("[admin/products/upsert] error", msg);
    return NextResponse.json({ error: msg }, { status });
  }
}
