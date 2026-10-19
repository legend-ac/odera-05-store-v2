import { expect, test, type Page } from "@playwright/test";

type MotionEntry = { id: number; kind: string | null; critical: boolean; duration: number };
declare global { interface Window { __storeMotionChecks: MotionEntry[] } }

async function observeMotion(page: Page) {
  await page.addInitScript(() => {
    const ids = new WeakMap<Element, number>();
    let sequence = 0;
    window.__storeMotionChecks = [];
    new MutationObserver((records) => {
      for (const record of records) {
        const element = record.target;
        if (!(element instanceof HTMLElement) || !element.closest("main") ||
          !element.matches(".reveal.visible") || ids.has(element)) continue;
        ids.set(element, ++sequence);
        window.__storeMotionChecks.push({
          id: sequence, kind: element.getAttribute("data-store-motion"),
          critical: element.matches("h1, img, form") || Boolean(element.querySelector("h1, form, img[fetchpriority='high']")),
          duration: parseFloat(getComputedStyle(element).transitionDuration) * 1000,
        });
      }
    }).observe(document, { attributes: true, attributeFilter: ["class"], subtree: true });
  });
}

test("la entrada y el desplazamiento animan contenido sin ocultar la portada ni bloquear enlaces", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await observeMotion(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByAltText("Colección ODERA 05", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__storeMotionChecks.filter(item => item.kind === "intro").length)).toBeGreaterThan(0);

  const category = page.locator('a[href^="/catalog?type="]').first();
  await category.scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.__storeMotionChecks.filter(item => item.kind === "card").length)).toBeGreaterThan(0);
  await category.focus();
  await expect(category).toBeFocused();
  await expect(category).toHaveCSS("opacity", "1");
  const entries = await page.evaluate(() => window.__storeMotionChecks);
  expect(entries.filter(item => item.critical || item.duration !== 650)).toEqual([]);
  expect(new Set(entries.map(item => item.id)).size).toBe(entries.length);
  const href = await category.getAttribute("href");
  await category.click();
  await expect(page).toHaveURL(new RegExp(`${href!.replace("?", "\\?")}$`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("el movimiento reducido mantiene todo visible sin animaciones de entrada", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await observeMotion(page);
  await page.goto("/");
  const categories = page.locator('a[href^="/catalog?type="]');
  await categories.last().scrollIntoViewIfNeeded();
  await expect(categories.first()).toBeVisible();
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.__storeMotionChecks)).toEqual([]);
  await expect(page.locator(".reveal:not(.visible)")).toHaveCount(0);
});

test("sin JavaScript el inicio conserva titular, imágenes y enlaces de categorías", async ({ browser, baseURL, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: page.viewportSize()! });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto(baseURL + "/");
    await expect(staticPage.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(staticPage.getByAltText("Colección ODERA 05", { exact: true })).toBeVisible();
    const categories = staticPage.locator('a[href^="/catalog?type="]');
    await expect(categories).toHaveCount(3);
    await expect(categories.last()).toBeVisible();
    await expect(staticPage.getByRole("link", { name: "Comprar ahora →", exact: true })).toBeVisible();
  } finally { await context.close(); }
});
