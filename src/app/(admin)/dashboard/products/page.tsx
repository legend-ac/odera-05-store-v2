export const runtime = "nodejs";
export const maxDuration = 60;

import { adminDb } from "@/lib/server/firebaseAdmin";
import ProductsClient from "./products-client";

export default async function ProductsPage() {
  let snap: any = null;
  try {
    snap = await adminDb.collection("products").orderBy("updatedAt", "desc").limit(50).get();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("NOT_FOUND")) throw e;
  }

  const products = (snap?.docs ?? []).map((d: any) => {
    const data = d.data() as any;
    return {
      id: d.id,
      slug: data.slug as string,
      status: data.status as string,
      name: data.name as string,
      price: data.price as number,
      onSale: Boolean(data.onSale),
      salePrice: typeof data.salePrice === "number" ? data.salePrice : null,
      brand: data.brand as string,
      category: data.category as string,
      description: data.description as string,
      images: Array.isArray(data.images) ? data.images : [],
      variants: Array.isArray(data.variants) ? data.variants : [],
    };
  });

  return <ProductsClient initialProducts={products} />;
}
