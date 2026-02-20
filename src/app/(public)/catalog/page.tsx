import { adminDb } from "@/lib/server/firebaseAdmin";
import CatalogClient from "./catalog-client";
import type { ProductCardData } from "@/components/ProductCard";

export const revalidate = 60;

async function loadInitialCatalog(): Promise<ProductCardData[]> {
  const snap = await adminDb.collection("products").where("status", "==", "active").limit(50).get();
  return snap.docs.map((d) => {
    const data = d.data() as any;
    const imgs = Array.isArray(data.images) ? [...data.images] : [];
    const sorted = imgs.sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
    const imageUrls = sorted.map((x: any) => String(x?.url ?? "")).filter(Boolean);
    const mainUrl = sorted.find((x: any) => x?.isMain)?.url ?? imageUrls[0];
    return {
      id: d.id,
      name: String(data.name ?? ""),
      price: Number(data.price ?? 0),
      salePrice: typeof data.salePrice === "number" ? data.salePrice : undefined,
      onSale: Boolean(data.onSale),
      imageUrl: typeof mainUrl === "string" ? mainUrl : undefined,
      imageUrls,
    };
  });
}

export default async function CatalogPage() {
  const initialItems = await loadInitialCatalog();
  return <CatalogClient initialItems={initialItems} />;
}
