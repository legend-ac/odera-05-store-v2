import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const dynamic = "force-dynamic";

type ProductImage = { url?: unknown; isMain?: unknown; order?: unknown };
type ProductVariant = { id?: unknown; size?: unknown; color?: unknown; stock?: unknown };

function validId(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(value);
}

/** Public, minimal product snapshots for the cart. This avoids client-side
 * Firestore reads, which may be delayed by rules or App Check initialization. */
export async function GET(request: NextRequest) {
  const ids = Array.from(new Set(
    (request.nextUrl.searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter(validId)
  )).slice(0, 30);
  if (!ids.length) return NextResponse.json({ products: [] });

  try {
    const snapshots = await adminDb.getAll(...ids.map((id) => adminDb.collection("products").doc(id)));
    const products = snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => {
      const data = snapshot.data() as Record<string, unknown>;
      const images = Array.isArray(data.images) ? (data.images as ProductImage[]) : [];
      const variants = Array.isArray(data.variants) ? (data.variants as ProductVariant[]) : [];
      return {
        id: snapshot.id,
        name: String(data.name ?? snapshot.id),
        price: Number(data.price ?? 0),
        salePrice: typeof data.salePrice === "number" ? data.salePrice : undefined,
        onSale: Boolean(data.onSale),
        images: images.map((image) => ({ url: String(image?.url ?? ""), isMain: Boolean(image?.isMain), order: Number(image?.order ?? 0) })).filter((image) => image.url),
        variants: variants.map((variant) => ({ id: String(variant?.id ?? ""), size: variant?.size ? String(variant.size) : undefined, color: variant?.color ? String(variant.color) : undefined, stock: Number(variant?.stock ?? 0) })).filter((variant) => variant.id),
      };
    });
    return NextResponse.json({ products }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el carrito." }, { status: 503 });
  }
}
