import { describe, expect, it } from "vitest";
import { buildProductMetadata, getMetadataBaseUrl, getProductCanonicalUrl } from "./productMetadata";

const baseUrl = new URL("https://store.example.test");
const product = {
  name: "Nike Air Max 90",
  brand: "Nike",
  description: "Zapatillas originales con amortiguación Air.",
  images: [
    { url: "/alternate.jpg", alt: "Vista lateral", order: 0, isMain: false },
    { url: "https://images.example.test/nike.jpg", alt: "Nike Air Max 90 blancas", order: 2, isMain: true },
  ],
};

describe("product sharing metadata", () => {
  it("uses the real name, description and main photo rather than the document ID", () => {
    const metadata = buildProductMetadata(product, "firestore-document-id", baseUrl);
    expect(metadata.title).toBe("Nike Air Max 90");
    expect(metadata.description).toBe(product.description);
    expect(metadata.alternates?.canonical).toBe("https://store.example.test/p/firestore-document-id");
    expect(metadata.openGraph).toMatchObject({
      title: "Nike Air Max 90 | ODERA 05 STORE",
      url: "https://store.example.test/p/firestore-document-id",
      images: [{ url: product.images[1]!.url, alt: product.images[1]!.alt }],
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: [{ url: product.images[1]!.url }] });
    // Product photos can have any aspect ratio; do not declare invented dimensions.
    expect(metadata.openGraph).not.toMatchObject({ images: [{ width: 1200, height: 630 }] });
  });

  it("falls back to a valid ordered image and resolves local image paths", () => {
    const metadata = buildProductMetadata({
      ...product,
      images: [{ url: "javascript:alert(1)", isMain: true, order: 0 }, ...product.images.slice(0, 1)],
    }, "p1", baseUrl);
    expect(metadata.openGraph).toMatchObject({ images: [{ url: "https://store.example.test/alternate.jpg", alt: "Vista lateral" }] });
  });

  it("keeps descriptions short and readable and uses a product-specific fallback", () => {
    const metadata = buildProductMetadata({ ...product, description: "<p> Original </p>\n  Nike <b>Air</b>" }, "p1", baseUrl);
    expect(metadata.description).toBe("Original Nike Air");
    expect(buildProductMetadata({ ...product, description: "" }, "p1", baseUrl).description).toContain(product.name);
    expect(buildProductMetadata({ ...product, description: "A".repeat(300) }, "p1", baseUrl).description!.length).toBeLessThanOrEqual(200);
  });

  it("does not index unavailable products or reveal product information", () => {
    const metadata = buildProductMetadata(null, "p1", baseUrl);
    expect(metadata.title).toBe("Producto no disponible");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.openGraph).toBeUndefined();
    expect(metadata.twitter).toBeUndefined();
  });

  it("supports a product without valid photos without publishing an unsafe URL", () => {
    const metadata = buildProductMetadata({ ...product, images: [{ url: "data:image/png;base64,image", isMain: true, order: 0 }] }, "p1", baseUrl);
    expect(metadata.openGraph).toMatchObject({ images: [
      { url: "https://store.example.test/og-home-social.jpg", width: 1200, height: 630, type: "image/jpeg" },
      { url: "https://store.example.test/og-square-social.jpg", width: 1200, height: 1200, type: "image/jpeg" },
    ] });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: [
      { url: "https://store.example.test/og-home-social.jpg" },
    ] });
  });
});

describe("metadata base URL", () => {
  it("prefers the explicitly configured public address over deployment addresses", () => {
    expect(getMetadataBaseUrl({
      NEXT_PUBLIC_SITE_URL: "https://shop.example.test/path",
      SITE_URL: "https://other.example.test",
      VERCEL_PROJECT_PRODUCTION_URL: "production.example.test",
      VERCEL_URL: "deployment.example.test",
    }).href).toBe("https://shop.example.test/");
  });

  it("uses the configured production deployment URL before preview URLs", () => {
    expect(getMetadataBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: "production.example.test", VERCEL_URL: "preview.example.test" }).href)
      .toBe("https://production.example.test/");
    expect(getMetadataBaseUrl({ VERCEL_URL: "deployment.example.test" }).href).toBe("https://deployment.example.test/");
  });

  it("falls back to the local preview when no safe URL is configured", () => {
    expect(getMetadataBaseUrl({}).href).toBe("http://localhost:3000/");
    expect(getMetadataBaseUrl({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)", SITE_URL: "https://user:secret@example.test" }).href)
      .toBe("http://localhost:3000/");
  });

  it("encodes the document ID as a single canonical path segment", () => {
    expect(getProductCanonicalUrl("shoe name?variant=2", baseUrl)).toBe("https://store.example.test/p/shoe%20name%3Fvariant%3D2");
  });
});
