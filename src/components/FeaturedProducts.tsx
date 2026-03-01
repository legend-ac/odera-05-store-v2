import { adminDb } from "@/lib/server/firebaseAdmin";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";
import { hasStock } from "@/lib/productStock";

export const revalidate = 60;

async function loadFeatured(): Promise<ProductCardData[]> {
  const snap = await adminDb.collection("products").where("status", "==", "active").limit(100).get();
  const raw = snap.docs.map((d) => {
    const data = d.data() as any;
    const imgs = Array.isArray(data.images) ? [...data.images] : [];
    const sorted = imgs.sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
    const imageUrls = sorted.map((x: any) => String(x?.url ?? "")).filter(Boolean);
    const mainUrl = sorted.find((x: any) => x?.isMain)?.url ?? imageUrls[0];
    const updatedAtMs = typeof data?.updatedAt?.toMillis === "function" ? data.updatedAt.toMillis() : 0;
    const dedupeKey = String(data?.slug ?? data?.name ?? d.id).trim().toLowerCase();
    const variants = Array.isArray(data?.variants) ? data.variants : [];
    return {
      id: d.id,
      name: String(data.name ?? ""),
      price: Number(data.price ?? 0),
      salePrice: typeof data.salePrice === "number" ? data.salePrice : undefined,
      onSale: Boolean(data.onSale),
      imageUrl: typeof mainUrl === "string" ? mainUrl : undefined,
      imageUrls,
      hasStock: hasStock(variants),
      dedupeKey,
      updatedAtMs,
    };
  });

  const byLatest = raw.filter((x: any) => x.hasStock).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  const seen = new Set<string>();
  const list: ProductCardData[] = [];
  for (const it of byLatest) {
    if (seen.has(it.dedupeKey)) continue;
    seen.add(it.dedupeKey);
    list.push({
      id: it.id,
      name: it.name,
      price: it.price,
      salePrice: it.salePrice,
      onSale: it.onSale,
      imageUrl: it.imageUrl,
      imageUrls: it.imageUrls,
    });
    if (list.length >= 6) break;
  }
  return list;
}

export default async function FeaturedProducts() {
  try {
    const items = await loadFeatured();
    if (!items.length) {
      return (
        <div className="panel rounded-2xl border-slate-200 p-6 text-center text-sm text-slate-600">
          Pronto publicaremos nuevos productos destacados.
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    );
  } catch (e) {
    console.error("[FeaturedProducts] load failed", e);
    return <div className="text-sm text-red-600">No pudimos cargar los productos destacados.</div>;
  }
}
