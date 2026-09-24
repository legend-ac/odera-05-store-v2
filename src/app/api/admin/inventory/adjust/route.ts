import { NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { z } from "zod";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { assertCsrfHeader } from "@/lib/server/csrf";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";
import { getRequestIp, getUserAgent } from "@/lib/server/ip";
import { deriveStockDrivenStatus, getInventorySummary } from "@/lib/productStock";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  productId: z.string().min(2).max(160),
  variantId: z.string().min(1).max(80),
  delta: z.number().int().min(-100000).max(100000).refine((value) => value !== 0, "El ajuste no puede ser cero"),
  reason: z.enum(["RECEIPT", "CORRECTION", "DAMAGE", "RETURN"]),
  note: z.string().trim().max(240).optional(),
});

/** A transaction-only stock movement. Never accept a final stock value from the browser. */
export async function POST(req: Request) {
  try {
    assertCsrfHeader(req);
    const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    const admin = await verifyAdminSessionCookie(sessionCookie);
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "VALIDATION_ERROR", issues: parsed.error.issues }, { status: 400 });

    const { productId, variantId, delta, reason, note } = parsed.data;
    const now = Timestamp.now();
    const ip = getRequestIp(req);
    const userAgent = getUserAgent(req);
    const ref = adminDb.collection("products").doc(productId);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("PRODUCT_NOT_FOUND");
      const product = snap.data() as any;
      if (product.deletedAt) throw new Error("PRODUCT_IN_TRASH");

      const variants = Array.isArray(product.variants) ? [...product.variants] : [];
      const index = variants.findIndex((variant: any) => String(variant?.id ?? "") === variantId);
      if (index < 0) throw new Error("VARIANT_NOT_FOUND");
      const previous = Math.max(0, Number(variants[index]?.stock ?? 0));
      const next = previous + delta;
      if (next < 0) throw new Error("INSUFFICIENT_STOCK");

      variants[index] = { ...variants[index], stock: next };
      const status = deriveStockDrivenStatus(
        (product.status as "active" | "archived") ?? "active",
        variants,
        Boolean(product.autoArchivedByStock)
      );
      const inventory = getInventorySummary(variants);

      tx.update(ref, {
        variants,
        status: status.status,
        autoArchivedByStock: status.autoArchivedByStock,
        ...inventory,
        inventoryUpdatedAt: now,
        updatedAt: now,
      });
      tx.set(adminDb.collection("stockLogs").doc(), {
        productId,
        variantId,
        delta,
        reason,
        note: note || null,
        beforeStock: previous,
        afterStock: next,
        actor: { uid: admin.uid, email: admin.email },
        createdAt: now,
      });
      tx.set(adminDb.collection("auditLogs").doc(), {
        actor: { uid: admin.uid, email: admin.email },
        action: "INVENTORY_ADJUSTED",
        target: { type: "product", id: productId, variantId },
        before: { variantStock: previous, inventoryTotal: Number(product.inventoryTotal ?? 0) },
        after: { variantStock: next, ...inventory },
        meta: { ip, userAgent, reason, note: note || null },
        createdAt: now,
      });
      return { inventoryTotal: inventory.inventoryTotal, inventoryState: inventory.inventoryState, variantStock: next, status: status.status };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status: Record<string, number> = {
      CSRF_FAILED: 403,
      NOT_ADMIN: 403,
      AUTH_TOO_OLD: 401,
      PRODUCT_NOT_FOUND: 404,
      VARIANT_NOT_FOUND: 404,
      PRODUCT_IN_TRASH: 409,
      INSUFFICIENT_STOCK: 409,
    };
    return NextResponse.json({ error: message }, { status: status[message] ?? 500 });
  }
}
