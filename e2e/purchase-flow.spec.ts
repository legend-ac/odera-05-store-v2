import { expect, test } from "@playwright/test";

test.describe("flujo público de compra", () => {
  test("catálogo → producto → carrito → checkout", async ({ page }) => {
    await page.goto("/catalog");

    const productLink = page.locator('a[href^="/p/"]').first();
    await expect(productLink).toBeVisible();
    const href = await productLink.getAttribute("href");
    expect(href).toMatch(/^\/p\/[a-z0-9-]+$/i);

    await productLink.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const addToCart = page.getByRole("button", { name: /añadir al carrito/i });
    await expect(addToCart).toBeEnabled();
    await addToCart.click();

    await expect(page.getByRole("heading", { name: /¿continúas comprando\?/i })).toBeVisible();
    await page.getByRole("link", { name: /ver mi carrito/i }).click();

    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByRole("heading", { name: /carrito de compras/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /continuar compra/i })).toBeVisible();
    await page.getByRole("link", { name: /continuar compra/i }).click();

    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { name: /finalizar compra/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /resumen del pedido/i })).toBeVisible();
  });
});
