import { adminDb } from "@/lib/server/firebaseAdmin";
import CatalogClient from "./catalog-client";
import type { ProductCardData } from "@/components/ProductCard";

export const revalidate = 60;

type CatalogItem = ProductCardData & { productType?: string };
type ProductTypeOption = { key: string; label: string };

const DEFAULT_PRODUCT_TYPES: ProductTypeOption[] = [
  { key: "zapatillas", label: "Zapatillas" },
  { key: "ropa", label: "Ropa" },
  { key: "accesorios", label: "Accesorios" },
];

async function loadInitialCatalog(): Promise<CatalogItem[]> {
  const snap = await adminDb.collection("products").where("status", "==", "active").limit(150).get();
  const raw = snap.docs.map((d) => {
    const data = d.data() as any;
    const imgs = Array.isArray(data.images) ? [...data.images] : [];
    const sorted = imgs.sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
    const imageUrls = sorted.map((x: any) => String(x?.url ?? "")).filter(Boolean);
    const mainUrl = sorted.find((x: any) => x?.isMain)?.url ?? imageUrls[0];
    const updatedAtMs = typeof data?.updatedAt?.toMillis === "function" ? data.updatedAt.toMillis() : 0;
    const dedupeKey = String(data?.slug ?? data?.name ?? d.id).trim().toLowerCase();
    return {
      id: d.id,
      name: String(data.name ?? ""),
      price: Number(data.price ?? 0),
      salePrice: typeof data.salePrice === "number" ? data.salePrice : undefined,
      onSale: Boolean(data.onSale),
      imageUrl: typeof mainUrl === "string" ? mainUrl : undefined,
      imageUrls,
      productType: (String(data?.productType ?? "").toLowerCase() as CatalogItem["productType"]) || undefined,
      dedupeKey,
      updatedAtMs,
    };
  });

  const byLatest = raw.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  const seen = new Set<string>();
  const list: CatalogItem[] = [];
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
      productType: it.productType,
    });
    if (list.length >= 50) break;
  }
  return list;
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  let productTypes: ProductTypeOption[] = DEFAULT_PRODUCT_TYPES;
  const initialItems = await loadInitialCatalog();

  try {
    const settingsSnap = await adminDb.doc("settings/store").get();
    if (settingsSnap.exists) {
      const data = settingsSnap.data() as any;
      const raw = Array.isArray(data?.productTypes) ? data.productTypes : [];
      const parsed = raw
        .filter((x: any) => Boolean(x?.enabled ?? true))
        .map((x: any) => ({ key: String(x?.key ?? "").trim(), label: String(x?.label ?? "").trim() }))
        .filter((x: ProductTypeOption) => x.key.length > 0 && x.label.length > 0);
      if (parsed.length) productTypes = parsed;
    }
  } catch {}

  const q = searchParams?.q;
  const initialQuery = Array.isArray(q) ? q[0] ?? "" : q ?? "";
  const type = searchParams?.type;
  const initialType = Array.isArray(type) ? type[0] ?? "" : type ?? "";
  return <CatalogClient initialItems={initialItems} initialQuery={initialQuery} initialType={initialType} productTypes={productTypes} />;
}
