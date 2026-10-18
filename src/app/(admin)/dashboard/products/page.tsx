export const runtime = "nodejs";
export const maxDuration = 60;

import { adminDb } from "@/lib/server/firebaseAdmin";
import ProductsClient from "./products-client";

const CATALOG_PAGE_SIZE = 90;

function validDocumentId(value: string | string[] | undefined): string {
  return typeof value === "string" && value.length <= 1500 && value !== "." && value !== ".." && !value.includes("/") ? value : "";
}

function mapProduct(document: FirebaseFirestore.DocumentSnapshot) {
  const data = document.data() as any;
  const toMs = (timestamp: any) => typeof timestamp?.toMillis === "function" ? timestamp.toMillis() : null;
  return {
    id: document.id,
    productType: data.productType || "zapatillas",
    audience: data.audience || "todos",
    slug: data.slug || document.id,
    status: data.status || "archived",
    name: data.name || "",
    price: Number(data.price ?? 0),
    onSale: Boolean(data.onSale),
    salePrice: typeof data.salePrice === "number" ? data.salePrice : null,
    brand: data.brand || "",
    category: data.category || "",
    description: data.description || "",
    images: Array.isArray(data.images) ? data.images : [],
    variants: Array.isArray(data.variants) ? data.variants : [],
    deletedAtMs: toMs(data.deletedAt),
    updatedAtMs: toMs(data.updatedAt),
  };
}

export default async function ProductsPage({ searchParams }: { searchParams?: Promise<{ edit?: string | string[]; after?: string | string[]; before?: string | string[] }> }) {
  const params = await searchParams;
  const after = validDocumentId(params?.after);
  const before = !after ? validDocumentId(params?.before) : "";
  const requestedId = validDocumentId(params?.edit);
  let loadError: string | undefined;
  let cursor: FirebaseFirestore.DocumentSnapshot | undefined;
  let settingsSnap: FirebaseFirestore.DocumentSnapshot | undefined;
  let documents: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let hasPrevious = false;
  let hasNext = false;

  try {
    if (after || before) {
      const snapshot = await adminDb.collection("products").doc(after || before).get();
      if (snapshot.exists && snapshot.get("updatedAt")) cursor = snapshot;
      else loadError = "La página anterior ya cambió. Te mostramos los productos más recientes.";
    }

    let catalogQuery = adminDb.collection("products").orderBy("updatedAt", "desc");
    if (cursor && after) catalogQuery = catalogQuery.startAfter(cursor);
    else if (cursor && before) catalogQuery = catalogQuery.endBefore(cursor);

    const [snapshot, settings] = await Promise.all([
      cursor && before ? catalogQuery.limitToLast(CATALOG_PAGE_SIZE + 1).get() : catalogQuery.limit(CATALOG_PAGE_SIZE + 1).get(),
      adminDb.doc("settings/store").get(),
    ]);
    settingsSnap = settings;
    const hasExtra = snapshot.size > CATALOG_PAGE_SIZE;
    documents = cursor && before ? snapshot.docs.slice(hasExtra ? 1 : 0) : snapshot.docs.slice(0, CATALOG_PAGE_SIZE);
    hasPrevious = cursor && before ? hasExtra : Boolean(cursor && after);
    hasNext = cursor && before ? true : hasExtra;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("NOT_FOUND")) throw error;
    loadError = "No se pudo cargar el catálogo. Vuelve a intentarlo.";
  }

  const first = documents[0];
  const last = documents[documents.length - 1];
  const previousPage = hasPrevious ? first ? `/dashboard/products?before=${encodeURIComponent(first.id)}` : "/dashboard/products" : undefined;
  const nextPage = hasNext && last ? `/dashboard/products?after=${encodeURIComponent(last.id)}` : undefined;
  const products = documents.map(mapProduct);

  // Inventory can open any product directly, even when it is outside this page.
  if (requestedId && !products.some((product) => product.id === requestedId)) {
    const selected = await adminDb.collection("products").doc(requestedId).get();
    if (selected.exists) products.unshift(mapProduct(selected));
    else loadError = "El producto solicitado ya no existe. Puedes buscar otro producto en el catálogo.";
  }

  const rawTypes = settingsSnap?.exists ? (settingsSnap.data() as any)?.productTypes : null;
  const initialProductTypes = Array.isArray(rawTypes) && rawTypes.length
    ? rawTypes.filter((type: any) => Boolean(type?.enabled ?? true)).map((type: any) => ({ key: String(type?.key ?? ""), label: String(type?.label ?? "") })).filter((type: any) => type.key && type.label)
    : [{ key: "zapatillas", label: "Zapatillas" }, { key: "ropa", label: "Ropa" }, { key: "accesorios", label: "Accesorios" }];

  return <ProductsClient key={`${after}:${before}:${requestedId}`} initialProducts={products} initialProductTypes={initialProductTypes} initialSelectedId={products.some((product) => product.id === requestedId) ? requestedId : undefined} previousPage={previousPage} nextPage={nextPage} loadError={loadError} />;
}
