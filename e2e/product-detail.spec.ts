import { expect, test } from "@playwright/test";

test("la ficha permite elegir fotos y talla sin solapar los controles de compra", async ({ page }) => {
  await page.route(/\/api\/(create-order|submit-payment)(?:\?|$)/, route => route.abort());
  await page.goto("/catalog");
  await page.locator('a[href^="/p/"]').first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const sizes = page.locator(".product-variant:enabled");
  await sizes.first().click();
  await expect(sizes.first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Añadir al carrito", exact: true })).toBeEnabled();

  const thumbs = page.locator(".product-gallery__thumbnail");
  if (await thumbs.count() > 1) {
    await thumbs.nth(1).click();
    await expect(thumbs.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".product-gallery__count")).toHaveText(/^2 \/ /);
  }

  const quantity = page.locator(".product-quantity__stepper span");
  await expect(quantity).toHaveText("1");
  await expect(page.getByRole("button", { name: "Reducir cantidad", exact: true })).toBeDisabled();

  await page.locator(".product-variants").scrollIntoViewIfNeeded();
  const layout = await page.evaluate(() => {
    const variants = document.querySelector(".product-variants")!.getBoundingClientRect();
    const purchase = document.querySelector(".product-purchase")!.getBoundingClientRect();
    const details = document.querySelector(".product-specifications")?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      purchaseFollowsSizes: purchase.top >= variants.bottom,
      detailsFollowPurchase: !details || details.top >= purchase.bottom,
    };
  });
  expect(layout).toEqual({ overflow: false, purchaseFollowsSizes: true, detailsFollowPurchase: true });
});
