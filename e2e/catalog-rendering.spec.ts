import { expect, test } from "@playwright/test";

test("el catálogo entrega productos y búsqueda en HTML sin esperar JavaScript", async ({ browser, baseURL, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: page.viewportSize()! });
  try {
    const catalog = await context.newPage();
    const response = await catalog.goto(`${baseURL}/catalog`, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(catalog.getByRole("heading", { level: 1, name: "Catálogo", exact: true })).toBeVisible();
    const first = catalog.locator('a[href^="/p/"]').first();
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute("data-store-motion", "off");
    await expect(first.locator("img")).toHaveAttribute("fetchpriority", "high");
    const href = await first.getAttribute("href");
    const name = await first.locator("p").first().innerText();

    if (catalog.viewportSize()!.width >= 768) {
      // The desktop form must submit a normal GET before React hydrates.
      const search = catalog.locator('header form[action="/catalog"][method="get"] input[name="q"]').first();
      await expect(search).toBeVisible();
      await search.fill(name);
      await Promise.all([
        catalog.waitForURL((url) => url.pathname === "/catalog" && url.searchParams.get("q") === name, { waitUntil: "domcontentloaded" }),
        search.press("Enter"),
      ]);
    } else {
      await catalog.goto(`${baseURL}/catalog?q=${encodeURIComponent(name)}`, { waitUntil: "domcontentloaded" });
    }
    expect(new URL(catalog.url()).searchParams.get("q")).toBe(name);
    await expect(catalog.locator(`a[href="${href}"]`)).toBeVisible();
    expect(await catalog.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  } finally { await context.close(); }
});
