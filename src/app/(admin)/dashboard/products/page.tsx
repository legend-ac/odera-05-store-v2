export const runtime = "nodejs";
export const maxDuration = 60;

import { adminDb } from "@/lib/server/firebaseAdmin";
import ProductsClient from "./products-client";

export default async function ProductsPage() {
  let snap: any = null;
  let settingsSnap: any = null;
  try {
    snap = await adminDb.collection("products").orderBy("updatedAt", "desc").limit(300).get();
    settingsSnap = await adminDb.doc("settings/store").get();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("NOT_FOUND")) throw e;
  }

  const products = (snap?.docs ?? []).map((d: any) => {
    const data = d.data() as any;
    const toMs = (ts: any) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : null);
    return {
      id: d.id,
      productType: (data.productType as string) || "zapatillas",
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
      deletedAtMs: toMs(data.deletedAt),
    };
  });

  const rawTypes = settingsSnap?.exists ? (settingsSnap.data() as any)?.productTypes : null;
  const initialProductTypes =
    Array.isArray(rawTypes) && rawTypes.length
      ? rawTypes
          .filter((x: any) => Boolean(x?.enabled ?? true))
          .map((x: any) => ({ key: String(x?.key ?? ""), label: String(x?.label ?? "") }))
          .filter((x: any) => x.key && x.label)
      : [
          { key: "zapatillas", label: "Zapatillas" },
          { key: "ropa", label: "Ropa" },
          { key: "accesorios", label: "Accesorios" },
        ];

  return <ProductsClient initialProducts={products} initialProductTypes={initialProductTypes} />;
}
