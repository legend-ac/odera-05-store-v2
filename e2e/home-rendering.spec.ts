import { expect, test } from "@playwright/test";

test("el inicio se hidrata sin errores y evita duplicar las redes en el pie", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const footer = page.getByRole("contentinfo");
  await expect(footer).toHaveClass("mt-0");
  await expect(footer.getByText(/todos los derechos reservados/i)).toBeVisible();
  await expect(footer.getByRole("navigation", { name: "Redes sociales de ODERA 05" })).toHaveCount(0);

  await footer.getByRole("link", { name: "Mi carrito", exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(footer).toHaveClass("mt-12");
  await footer.getByRole("link", { name: "Ir al inicio de ODERA 05 Store" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(footer).toHaveClass("mt-0");
  await expect(footer.getByRole("navigation", { name: "Redes sociales de ODERA 05" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
