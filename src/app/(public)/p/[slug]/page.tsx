import { adminDb } from "@/lib/server/firebaseAdmin";
import ProductClient from "./product-client";
import type { ProductCardData } from "@/components/ProductCard";

type Variant = { id: string; size?: string; color?: string; sku?: string; stock: number };
type Img = { url: string; alt?: string; isMain: boolean; order: number };

type ProductInitial = {
  id: string;
  name: string;
  brand?: string;
  price: number;
  salePrice?: number;
  onSale: boolean;
  description?: string;
  variants: Variant[];
  images: Img[];
};

async function loadInitialProduct(slug: string): Promise<ProductInitial | null> {
  const snap = await adminDb.doc(`products/${slug}`).get();
  if (!snap.exists) return null;
  const d = snap.data() as any;
  return {
    id: snap.id,
    name: String(d?.name ?? ""),
    brand: d?.brand ? String(d.brand) : undefined,
    price: Number(d?.price ?? 0),
    salePrice: typeof d?.salePrice === "number" ? d.salePrice : undefined,
    onSale: Boolean(d?.onSale),
    description: d?.description ? String(d.description) : undefined,
    variants: Array.isArray(d?.variants) ? (d.variants as Variant[]) : [],
    images: Array.isArray(d?.images) ? (d.images as Img[]) : [],
  };
}

async function loadInitialRecommended(slug: string): Promise<ProductCardData[]> {
  const snap = await adminDb.collection("products").where("status", "==", "active").limit(20).get();
  return snap.docs
    .filter((d) => d.id !== slug)
    .slice(0, 3)
    .map((d) => {
      const product = d.data() as any;
      const imgs = Array.isArray(product.images) ? [...product.images] : [];
      const sorted = imgs.sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
      const imageUrls = sorted.map((x: any) => String(x?.url ?? "")).filter(Boolean);
      const mainUrl = sorted.find((x: any) => x?.isMain)?.url ?? imageUrls[0];
      return {
        id: d.id,
        name: String(product.name ?? ""),
        price: Number(product.price ?? 0),
        salePrice: typeof product.salePrice === "number" ? product.salePrice : undefined,
        onSale: Boolean(product.onSale),
        imageUrl: typeof mainUrl === "string" ? mainUrl : undefined,
        imageUrls,
      } satisfies ProductCardData;
    });
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const [initialProduct, initialRecommended] = await Promise.all([
    loadInitialProduct(params.slug),
    loadInitialRecommended(params.slug),
  ]);

  return (
    <ProductClient
      slug={params.slug}
      initialProduct={initialProduct}
      initialRecommended={initialRecommended}
    />
  );
}
