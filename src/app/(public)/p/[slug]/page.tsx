import type { Metadata } from "next";
import { cache } from "react";

import { adminDb } from "@/lib/server/firebaseAdmin";
import ProductClient from "./product-client";
import { hasStock } from "@/lib/productStock";
import { buildProductMetadata, getProductCanonicalUrl } from "@/lib/productMetadata";

export const revalidate = 120;

type Variant = { id: string; size?: string; color?: string; sku?: string; stock: number };
type Img = { url: string; alt?: string; isMain: boolean; order: number };

type ProductInitial = {
  id: string;
  name: string;
  brand?: string;
  productType?: string;
  price: number;
  salePrice?: number;
  onSale: boolean;
  description?: string;
  variants: Variant[];
  images: Img[];
};

function pickMainImage(images: Img[]): string | undefined {
  const sorted = [...images].sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
  const urls = sorted.map((x) => String(x?.url ?? "")).filter(Boolean);
  const main = sorted.find((x) => x?.isMain)?.url;
  return (main && String(main)) || urls[0];
}

const loadInitialProduct = cache(async (slug: string): Promise<ProductInitial | null> => {
  try {
    const snap = await adminDb.doc(`products/${slug}`).get();
    if (!snap.exists) return null;
    const d = snap.data() as any;
    const variants = Array.isArray(d?.variants) ? (d.variants as Variant[]) : [];
    const status = String(d?.status ?? "active");
    if (status !== "active" || !hasStock(variants)) return null;
    return {
      id: snap.id,
      name: String(d?.name ?? ""),
      brand: d?.brand ? String(d.brand) : undefined,
      productType: d?.productType ? String(d.productType) : undefined,
      price: Number(d?.price ?? 0),
      salePrice: typeof d?.salePrice === "number" ? d.salePrice : undefined,
      onSale: Boolean(d?.onSale),
      description: d?.description ? String(d.description) : undefined,
      variants,
      images: Array.isArray(d?.images) ? (d.images as Img[]) : [],
    };
  } catch (error) {
    // A temporary data-service error must never render a blank product page.
    console.error("[product-page] initial product lookup failed", error);
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildProductMetadata(await loadInitialProduct(slug), slug);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const initialProduct = await loadInitialProduct(slug);

  if (!initialProduct) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold" style={{ color: "var(--paper)" }}>Producto no disponible</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ash)" }}>Este producto ya no está disponible. Revisa otras opciones en nuestro catálogo.</p>
        <a
          href="/catalog"
          className="btn-soft mt-5 inline-flex text-sm"
        >
          Volver al catálogo
        </a>
      </section>
    );
  }

  const finalPrice = initialProduct.onSale && typeof initialProduct.salePrice === "number"
    ? initialProduct.salePrice
    : initialProduct.price;
  const image = pickMainImage(initialProduct.images);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: initialProduct.name,
    brand: initialProduct.brand ? { "@type": "Brand", name: initialProduct.brand } : undefined,
    image: image ? [image] : undefined,
    description: initialProduct.description ?? initialProduct.name,
    offers: {
      "@type": "Offer",
      priceCurrency: "PEN",
      price: String(finalPrice),
      availability: "https://schema.org/InStock",
      url: getProductCanonicalUrl(slug),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductClient
        slug={slug}
        initialProduct={initialProduct}
        initialRecommended={[]}
      />
    </>
  );
}
