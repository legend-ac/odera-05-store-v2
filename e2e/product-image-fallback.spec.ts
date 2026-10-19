import { expect, test } from "@playwright/test";

const PRODUCT_ID = "e2e-image-product";
const VARIANT_ID = "e2e-image-size";
const PRODUCT_NAME = "Producto con fotos de prueba";
const FIRST = "https://res.cloudinary.com/e2e-image-tests/image/upload/first.png";
const SECOND = "https://res.cloudinary.com/e2e-image-tests/image/upload/second.png";
const REPLACEMENT = "https://res.cloudinary.com/e2e-image-tests/image/upload/replacement.png";
// A realistic intrinsic size keeps naturalWidth positive after the browser
// applies the responsive source's width descriptor and device pixel ratio.
const PRODUCT_PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#f8f5ee"/><path d="M80 288h352v64H80z" fill="#c8331c"/></svg>';

test.describe("respaldo de imágenes de productos", () => {
  test.beforeEach(async ({ page }) => {
    // These tests do not submit orders, reserve stock or upload files.
    await page.route(/\/api\/(create-order|submit-payment)\/?(?:\?.*)?$/, (route) => route.abort());
    await page.route("https://api.cloudinary.com/**", (route) => route.abort());
  });

  test("agota las fotos una vez y recupera una foto nueva sin cambiar el número de imágenes", async ({ page }) => {
    let refresh = false;
    const attempted: string[] = [];
    await page.route(/\/api\/products\/cart(?:\?.*)?$/, (route) => route.fulfill({ json: {
      products: [{
        id: PRODUCT_ID, status: "active", name: PRODUCT_NAME, price: 150, onSale: false,
        images: refresh
          ? [{ url: REPLACEMENT, isMain: true, order: 0 }, { url: SECOND, isMain: false, order: 1 }]
          : [{ url: FIRST, isMain: true, order: 0 }, { url: SECOND, isMain: false, order: 1 }],
        variants: [{ id: VARIANT_ID, size: "42", stock: 5 }],
      }], shipping: { baseCost: 10, freeShippingFrom: 200 },
    } }));
    await page.route("https://res.cloudinary.com/e2e-image-tests/**", async (route) => {
      const filename = new URL(route.request().url()).pathname.split("/").pop()!;
      attempted.push(filename);
      if (filename === "replacement.png") await route.fulfill({ contentType: "image/svg+xml", body: PRODUCT_PHOTO });
      else await route.abort();
    });
    await page.addInitScript(({ productId, variantId }) => {
      localStorage.setItem("odera_cart_v1", JSON.stringify([{ productId, variantId, qty: 1 }]));
    }, { productId: PRODUCT_ID, variantId: VARIANT_ID });

    await page.goto("/cart");
    const placeholder = page.getByRole("img", { name: `Imagen no disponible de ${PRODUCT_NAME}`, exact: true });
    await expect(placeholder).toBeVisible();
    await expect(page.getByRole("img", { name: PRODUCT_NAME, exact: true })).toHaveCount(0);
    expect(attempted).toEqual(["first.png", "second.png"]);

    // A quantity refresh supplies a new main image with the same list length.
    refresh = true;
    await page.getByRole("button", { name: "+", exact: true }).click();
    const recovered = page.getByRole("img", { name: PRODUCT_NAME, exact: true });
    await expect(recovered).toBeVisible();
    await expect.poll(() => recovered.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(placeholder).toHaveCount(0);
    expect(attempted).toEqual(["first.png", "second.png", "replacement.png"]);
  });

  test("las tarjetas y la galería muestran el respaldo al fallar todas las fotos", async ({ page }) => {
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() === "image") await route.abort();
      else await route.fallback();
    });
    await page.goto("/catalog");
    const product = page.locator('a[href^="/p/"]').first();
    await expect(product).toBeVisible();
    await expect(product.getByRole("img", { name: /^Imagen no disponible de / })).toBeVisible();
    await expect(product.locator("img")).toHaveCount(0);
    await product.click();

    const gallery = page.locator(".product-page .touch-pan-y");
    await expect(gallery.getByRole("img", { name: /^Imagen no disponible de / })).toBeVisible();
    await expect(gallery.locator("img")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Siguiente imagen", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Imagen anterior", exact: true })).toHaveCount(0);
  });
});
