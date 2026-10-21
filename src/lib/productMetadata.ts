import type { Metadata } from "next";
import { getSocialImages } from "./socialImages";

type SiteEnvironment = Partial<Record<
  "NEXT_PUBLIC_SITE_URL" | "SITE_URL" | "VERCEL_PROJECT_PRODUCTION_URL" | "VERCEL_URL",
  string | undefined
>>;

type ShareableProduct = {
  name: string;
  brand?: string;
  description?: string;
  images: { url: string; alt?: string; isMain: boolean; order: number }[];
};

/** Keep local previews usable without inventing a production domain. */
export function getMetadataBaseUrl(env: SiteEnvironment = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  SITE_URL: process.env.SITE_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_URL: process.env.VERCEL_URL,
}): URL {
  const candidates = [
    env.NEXT_PUBLIC_SITE_URL,
    env.SITE_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`,
    env.VERCEL_URL && `https://${env.VERCEL_URL}`,
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    try {
      const url = new URL(candidate.trim().replace(/^["']|["']$/g, ""));
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) continue;
      return new URL(url.origin);
    } catch {
      // A malformed optional URL must not prevent the product page loading.
    }
  }
  return new URL("http://localhost:3000");
}

export function getProductCanonicalUrl(slug: string, baseUrl = getMetadataBaseUrl()): string {
  return new URL(`/p/${encodeURIComponent(slug)}`, baseUrl).href;
}

function plainDescription(description: string): string {
  const text = description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 200 ? `${text.slice(0, 197).trimEnd()}…` : text;
}

export function buildProductMetadata(
  product: ShareableProduct | null,
  slug: string,
  baseUrl = getMetadataBaseUrl(),
): Metadata {
  const canonical = getProductCanonicalUrl(slug, baseUrl);
  if (!product) {
    return {
      title: "Producto no disponible",
      description: "Este producto no está disponible. Encuentra otras opciones en el catálogo de ODERA 05 STORE.",
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  const title = product.name.trim() || "Producto original";
  const description = plainDescription(product.description ?? "") ||
    `${title}${product.brand ? ` de ${product.brand}` : ""}. Compra en ODERA 05 STORE con Yape o Plin y sigue tu pedido.`;
  const sortedImages = [...product.images].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  const candidates = [...sortedImages.filter((item) => item.isMain), ...sortedImages.filter((item) => !item.isMain)];
  let image: { url: string; alt: string } | undefined;
  for (const candidate of candidates) {
    if (!candidate.url?.trim()) continue;
    try {
      const url = new URL(candidate.url.trim(), baseUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) continue;
      image = { url: url.href, alt: candidate.alt?.trim() || title };
      break;
    } catch {
      // Try the next product image if this URL is malformed.
    }
  }

  const ogImages = image
    ? [image]
    : getSocialImages("home", baseUrl);

  return {
    // The root layout adds the store name once through its title template.
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "es_PE",
      siteName: "ODERA 05 STORE",
      title: `${title} | ODERA 05 STORE`,
      description,
      url: canonical,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ODERA 05 STORE`,
      description,
      images: ogImages.slice(0, 1).map((img) => ({ url: img.url, alt: img.alt })),
    },
  };
}
