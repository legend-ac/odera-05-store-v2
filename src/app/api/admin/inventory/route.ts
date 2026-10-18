import { NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { SESSION_COOKIE_NAME, verifyAdminSessionCookie } from "@/lib/server/adminSession";

export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE = 50;
const STATES = new Set(["OUT", "LOW", "HEALTHY"]);

function toMs(value: any): number | null {
  return typeof value?.toMillis === "function" ? value.toMillis() : null;
}

/** Cursor-paginated operational list; full product documents are never sent to the browser at once. */
export async function GET(req: Request) {
  try {
    const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    await verifyAdminSessionCookie(sessionCookie);

    const url = new URL(req.url);
    const state = url.searchParams.get("state") ?? "ALL";
    const search = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const cursorRaw = url.searchParams.get("cursor");
    let cursor: { total: number; id: string } | null = null;
    if (cursorRaw) {
      try {
        const parsed = JSON.parse(Buffer.from(cursorRaw, "base64url").toString("utf8"));
        if (!parsed || !Number.isSafeInteger(parsed.total) || parsed.total < 0 || typeof parsed.id !== "string" || !parsed.id || parsed.id.length > 160 || parsed.id.includes("/")) throw new Error("INVALID_CURSOR");
        cursor = { total: parsed.total, id: parsed.id };
      } catch {
        return NextResponse.json({ error: "INVALID_CURSOR" }, { status: 400 });
      }
    }

    // Search uses the existing token index. It intentionally returns a bounded
    // result set because an exact search is a locating tool, not a catalogue export.
    let docs: FirebaseFirestore.QueryDocumentSnapshot[];
    let nextCursor: string | null = null;
    if (search) {
      const token = search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/)[0] ?? "";
      const snap = await adminDb.collection("products").where("searchTokens", "array-contains", token).limit(100).get();
      docs = snap.docs
        .filter((doc) => {
          const data = doc.data() as any;
          return !data.deletedAt && (state === "ALL" || data.inventoryState === state);
        })
        .sort((a, b) => Number(a.data().inventoryTotal ?? 0) - Number(b.data().inventoryTotal ?? 0));
    } else {
      let query: FirebaseFirestore.Query = adminDb.collection("products").orderBy("inventoryTotal", "asc").orderBy(FieldPath.documentId()).limit(PAGE_SIZE + 1);
      if (STATES.has(state)) query = adminDb.collection("products").where("inventoryState", "==", state).orderBy("inventoryTotal", "asc").orderBy(FieldPath.documentId()).limit(PAGE_SIZE + 1);
      if (cursor && Number.isFinite(cursor.total) && cursor.id) query = query.startAfter(cursor.total, cursor.id);
      const snap = await query.get();
      // The extra document only signals that another page exists. Advance past
      // the 50 documents consumed by this page so the look-ahead item appears
      // on the next page, including when some scanned documents are in trash.
      const scanned = snap.docs.slice(0, PAGE_SIZE);
      const scannedLast = scanned[scanned.length - 1];
      docs = scanned.filter((doc) => !doc.data()?.deletedAt);
      if (snap.size > PAGE_SIZE && scannedLast) {
        nextCursor = Buffer.from(JSON.stringify({ total: Number(scannedLast.data().inventoryTotal ?? 0), id: scannedLast.id })).toString("base64url");
      }
    }

    return NextResponse.json({
      items: docs.map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          name: String(data.name ?? doc.id),
          slug: String(data.slug ?? doc.id),
          brand: String(data.brand ?? ""),
          productType: String(data.productType ?? ""),
          status: String(data.status ?? "archived"),
          inventoryTotal: Number(data.inventoryTotal ?? 0),
          inventoryState: String(data.inventoryState ?? "OUT"),
          inventoryUpdatedAtMs: toMs(data.inventoryUpdatedAt ?? data.updatedAt),
          variants: Array.isArray(data.variants)
            ? data.variants.map((variant: any) => ({ id: String(variant.id ?? ""), size: variant.size ? String(variant.size) : undefined, color: variant.color ? String(variant.color) : undefined, sku: variant.sku ? String(variant.sku) : undefined, stock: Math.max(0, Number(variant.stock ?? 0)) }))
            : [],
        };
      }),
      nextCursor,
      searchLimited: Boolean(search),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status: Record<string, number> = { UNAUTHENTICATED: 401, AUTH_TOO_OLD: 401, NOT_ADMIN: 403, INVALID_CURSOR: 400 };
    return NextResponse.json({ error: message }, { status: status[message] ?? 500 });
  }
}
