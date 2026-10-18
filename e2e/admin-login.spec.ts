import { expect, test } from "@playwright/test";

test("el acceso protegido conserva el destino y explica una ventana de Google bloqueada", async ({ page }) => {
  let sessionRequests = 0;
  await page.route("**/api/admin/session-login", route => {
    sessionRequests++;
    return route.abort();
  });
  // Simulate the browser's popup blocker without signing into a Google account.
  await page.addInitScript(() => { window.open = () => null; });

  await page.goto("/dashboard/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fsettings$/);
  const button = page.getByRole("button", { name: "Continuar con Google", exact: true });
  await button.click();
  await expect(page.getByRole("alert").filter({ hasText: "El navegador bloqueó" })).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fsettings$/);
  expect(sessionRequests).toBe(0);
});
