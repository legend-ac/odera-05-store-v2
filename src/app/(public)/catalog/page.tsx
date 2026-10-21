import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/server/firebaseAdmin";
import CatalogClient from "./catalog-client";
import type { ProductCardData } from "@/components/ProductCard";
import { hasStock } from "@/lib/productStock";
import { getSearchTerms, normalizeToken, productMatchesSearch } from "@/lib/searchTokens";
import { getSocialImages } from "@/lib/socialImages";

export const metadata: Metadata = {
  title: "Catálogo",
  description:
    "Explora zapatillas, ropa y accesorios originales. Filtra por categoría, público y precio. Envío a todo el Perú.",
  alternates: { canonical: "/catalog" },
  openGraph: {
    title: "Catálogo — ODERA 05 STORE",
    description:
      "Zapatillas, ropa y accesorios originales en un solo lugar. Filtra, elige y recibe en Lima o provincias.",
    siteName: "ODERA 05 STORE",
    locale: "es_PE",
    type: "website",
    url: "/catalog",
    images: getSocialImages("catalog"),
  },
  twitter: {
    card: "summary_large_image",
    title: "Catálogo — ODERA 05 STORE",
    description:
      "Zapatillas, ropa y accesorios originales. Filtra y encuentra tu producto favorito.",
    images: [getSocialImages("catalog")[0]],
  },
};

export const revalidate = 60;

type CatalogItem = ProductCardData & { productType?: string; audience?: "hombre" | "mujer" | "ninos" | "todos" };
type ProductTypeOption = { key: string; label: string };

const DEFAULT_PRODUCT_TYPES: ProductTypeOption[] = [
  { key: "zapatillas", label: "Zapatillas" },
  { key: "ropa", label: "Ropa" },
  { key: "accesorios", label: "Accesorios" },
];

function searchAudience(raw: unknown): CatalogItem["audience"] {
  const value = normalizeToken(String(raw ?? "")).replace(/\s+/g, "");
  if (value.startsWith("hombre")) return "hombre";
  if (value.startsWith("mujer")) return "mujer";
  if (value.startsWith("nino") || value.startsWith("nina")) return "ninos";
  return "todos";
}

function catalogItemsFromDocs(docs: Array<{ id: string; data(): any }>, searching = false): CatalogItem[] {
  const raw = docs.map((d) => {
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
      productType: (searching ? String(data?.productType ?? "").trim() : String(data?.productType ?? "").toLowerCase()) || undefined,
      audience: searching ? searchAudience(data?.audience) : (String(data?.audience ?? "todos").toLowerCase() as CatalogItem["audience"]) || "todos",
      hasStock: hasStock(variants),
      dedupeKey,
      updatedAtMs,
    };
  });

  const byLatest = raw.filter((x: any) => x.hasStock).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
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
      audience: it.audience,
    });
    if (list.length >= 50) break;
  }
  return list;
}

const loadInitialCatalog = unstable_cache(async (): Promise<CatalogItem[]> => {
  const snap = await adminDb.collection("products").where("status", "==", "active").limit(150).get();
  return catalogItemsFromDocs(snap.docs);
}, ["public-catalog-initial"], { revalidate: 60, tags: ["store-catalog"] });

const loadProductTypes = unstable_cache(async (): Promise<ProductTypeOption[]> => {
  try {
    const settingsSnap = await adminDb.doc("settings/store").get();
    if (settingsSnap.exists) {
      const data = settingsSnap.data();
      const raw = Array.isArray(data?.productTypes) ? data.productTypes : [];
      const parsed = raw
        .filter((x: any) => Boolean(x?.enabled ?? true))
        .map((x: any) => ({ key: String(x?.key ?? "").trim(), label: String(x?.label ?? "").trim() }))
        .filter((x: ProductTypeOption) => x.key.length > 0 && x.label.length > 0);
      if (parsed.length) return parsed;
    }
  } catch {
    // Keep the same default categories when settings are temporarily unavailable.
  }
  return DEFAULT_PRODUCT_TYPES;
}, ["public-catalog-product-types"], { revalidate: 60, tags: ["store-theme"] });

const loadSearchCatalog = unstable_cache(async (search: string): Promise<CatalogItem[]> => {
  const terms = getSearchTerms(search);
  const token = terms.find((term) => term.length >= 2) ?? "";
  const candidates: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let base: FirebaseFirestore.Query = adminDb.collection("products").where("status", "==", "active");
  if (token) base = base.where("searchTokens", "array-contains", token);
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  // Match the existing browser search: test every page against all query terms
  // before deduplicating and taking the 50 most recently updated products.
  while (true) {
    const snap = await (cursor ? base.startAfter(cursor) : base).limit(50).get();
    candidates.push(...snap.docs.filter((document) => productMatchesSearch(document.data(), terms)));
    if (snap.size < 50) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return catalogItemsFromDocs(candidates, true);
}, ["public-catalog-search"], { revalidate: 60, tags: ["store-catalog"] });

type CatalogSearchParams = { q?: string | string[]; type?: string | string[]; audience?: string | string[] };

function firstSearchParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<CatalogSearchParams> }) {
  const params = await searchParams;
  const routeQuery = firstSearchParam(params.q);
  const searchTerms = getSearchTerms(routeQuery);
  const [initialItems, productTypes, initialSearchItems] = await Promise.all([
    loadInitialCatalog(),
    loadProductTypes(),
    searchTerms.length ? loadSearchCatalog(searchTerms.join(" ")).catch(() => undefined) : undefined,
  ]);

  return (
    <CatalogClient
      initialItems={initialItems}
      initialSearchItems={initialSearchItems}
      productTypes={productTypes}
      routeQuery={routeQuery}
      routeType={firstSearchParam(params.type)}
      routeAudience={firstSearchParam(params.audience)}
    />
  );
}
