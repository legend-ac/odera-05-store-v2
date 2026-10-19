import { describe, expect, it } from "vitest";
import { cloudinaryImageLoader, optimizedProductImage, productImageDelivery } from "./image";

const image = "https://res.cloudinary.com/odera/image/upload/v123/products/shoe.webp";

describe("responsive product image delivery", () => {
  it("requests the selected browser width directly from Cloudinary", () => {
    expect(cloudinaryImageLoader({ src: image, width: 384 })).toBe(
      "https://res.cloudinary.com/odera/image/upload/f_auto,q_auto:eco,c_limit,w_384/v123/products/shoe.webp",
    );
    const delivery = productImageDelivery(image);
    expect(delivery.src).toBe(image);
    expect(delivery.unoptimized).toBe(false);
    expect(delivery.loader).toBe(cloudinaryImageLoader);
  });

  it("retains existing crops and effects before the responsive delivery step", () => {
    const cropped = image.replace("/upload/", "/upload/c_crop,g_center,h_800,w_1000/e_grayscale/");
    expect(optimizedProductImage(cropped, 320)).toContain(
      "/upload/c_crop,g_center,h_800,w_1000/e_grayscale/f_auto,q_auto:eco,c_limit,w_320/v123/products/shoe.webp",
    );
  });

  it("replaces only its own delivery transform instead of accumulating resizes", () => {
    const first = optimizedProductImage(image, 900);
    expect(optimizedProductImage(first, 320)).toBe(optimizedProductImage(image, 320));
    expect(optimizedProductImage(first, 900)).toBe(first);
  });

  it("resizes a previously formatted Cloudinary image rather than skipping optimization", () => {
    const formatted = image.replace("/upload/", "/upload/f_auto,q_auto/");
    expect(optimizedProductImage(formatted, 256)).toContain("/f_auto,q_auto/f_auto,q_auto:eco,c_limit,w_256/");
  });

  it("preserves versionless public IDs, folders, search parameters and fragments", () => {
    const source = "https://res.cloudinary.com/odera/image/upload/products/blue%20shoe.jpg?download=1#preview";
    expect(optimizedProductImage(source, 128)).toBe(
      "https://res.cloudinary.com/odera/image/upload/f_auto,q_auto:eco,c_limit,w_128/products/blue%20shoe.jpg?download=1#preview",
    );
  });

  it.each([
    "https://res.cloudinary.com/odera/image/upload/s--signed--/v123/shoe.jpg",
    "https://res.cloudinary.com/odera/image/upload/v123/shoe.jpg?__cld_token__=signed-token",
    "https://res.cloudinary.com/odera/image/private/v123/shoe.jpg",
    "https://res.cloudinary.com/odera/raw/upload/v123/shoe.jpg",
    "https://res.cloudinary.com.evil.test/odera/image/upload/shoe.jpg",
    "https://example.test/res.cloudinary.com/image/upload/shoe.jpg",
    "http://res.cloudinary.com/odera/image/upload/shoe.jpg",
    "/brand/category-zapatillas.jpg",
    "data:image/png;base64,AA==",
    "blob:https://store.example.test/preview",
  ])("keeps unsupported or signed source unchanged: %s", (source) => {
    expect(optimizedProductImage(source, 320)).toBe(source);
    expect(productImageDelivery(source)).toEqual({ src: source, unoptimized: true });
  });

  it.each([
    [10, 32], [1801, 1800], [383.7, 384], [Number.NaN, 900], [Number.POSITIVE_INFINITY, 900],
  ])("normalizes invalid or excessive requested widths (%s)", (requested, expected) => {
    expect(optimizedProductImage(image, requested)).toContain(`c_limit,w_${expected}/`);
  });

  it("returns an empty source when no image is available", () => {
    expect(optimizedProductImage(undefined)).toBe("");
    expect(optimizedProductImage("")).toBe("");
  });
});
