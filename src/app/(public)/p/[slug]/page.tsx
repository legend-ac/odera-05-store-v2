import type { Metadata } from "next";

import { adminDb } from "@/lib/server/firebaseAdmin";
import type { ProductCardData } from "@/components/ProductCard";
import ProductClient from "./product-client";
import { hasStock } from "@/lib/productStock";

export const revalidate = 120;

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

function pickMainImage(images: Img[]): string | undefined {
  const sorted = [...images].sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
  const urls = sorted.map((x) => String(x?.url ?? "")).filter(Boolean);
  const main = sorted.find((x) => x?.isMain)?.url;
  return (main && String(main)) || urls[0];
}

async function loadInitialProduct(slug: string): Promise<ProductInitial | null> {
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
    price: Number(d?.price ?? 0),
    salePrice: typeof d?.salePrice === "number" ? d.salePrice : undefined,
    onSale: Boolean(d?.onSale),
    description: d?.description ? String(d.description) : undefined,
    variants,
    images: Array.isArray(d?.images) ? (d.images as Img[]) : [],
  };
}

async function loadInitialRecommended(slug: string): Promise<ProductCardData[]> {
  const snap = await adminDb.collection("products").where("status", "==", "active").limit(20).get();
  return snap.docs
    .filter((d) => d.id !== slug)
    .map((d) => {
      const product = d.data() as any;
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      if (!hasStock(variants)) return null;
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
    })
    .filter(Boolean)
    .slice(0, 3) as ProductCardData[];
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await loadInitialProduct(params.slug);

  if (!product) {
    return {
      title: "Producto no disponible | ODERA 05 STORE",
      description: "El producto solicitado no esta disponible.",
      robots: { index: true, follow: true },
    };
  }

  const finalPrice = product.onSale && typeof product.salePrice === "number" ? product.salePrice : product.price;
  const image = pickMainImage(product.images);
  const description = String(product.description ?? product.name).slice(0, 160);

  return {
    title: `${product.name} | ODERA 05 STORE`,
    description,
    alternates: { canonical: `/p/${params.slug}` },
    openGraph: {
      title: `${product.name} | ODERA 05 STORE`,
      description,
      type: "website",
      images: image ? [image] : [],
    },
    other: {
      "product:price:amount": String(finalPrice),
      "product:price:currency": "PEN",
    },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const [initialProduct, initialRecommended] = await Promise.all([
    loadInitialProduct(params.slug),
    loadInitialRecommended(params.slug),
  ]);

  if (!initialProduct) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Producto no disponible</h1>
        <p className="mt-2 text-sm text-slate-600">Este producto ya no esta activo o fue retirado del catalogo.</p>
        <a
          href="/catalog"
          className="mt-4 inline-flex rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          Volver al catalogo
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
      url: `/p/${params.slug}`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductClient
        slug={params.slug}
        initialProduct={initialProduct}
        initialRecommended={initialRecommended}
      />
    </>
  );
}
