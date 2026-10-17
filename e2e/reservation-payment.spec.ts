import { expect, test, type Page } from "@playwright/test";

// All purchase writes and uploads are fulfilled locally. These tests must never
// create a real order, reserve real stock, or upload an actual receipt.
const PUBLIC_CODE = "OD-E2E-0001";
const TRACKING_TOKEN = "e2e-reservation-token-123";
const PRODUCT_ID = "e2e-reservation-product";
const VARIANT_ID = "e2e-size-42";
const RECEIPT_URL = "https://res.cloudinary.com/e2e-testing/image/upload/receipt.png";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jw1cAAAAASUVORK5CYII=", "base64");
const PAYMENT_PATH = `/checkout/pago?publicCode=${PUBLIC_CODE}&trackingToken=${TRACKING_TOKEN}`;
const TOTAL_PATTERN = /S\/\s*145[.,]00/;

function reservedOrder() {
  return {
    orderId: "e2e-order-only",
    publicCode: PUBLIC_CODE,
    status: "SCHEDULED",
    reservedUntilMs: Date.now() + 20 * 60_000,
    customer: { name: "Cliente de prueba", email: "checkout@example.test", phone: "900000001" },
    // Deliberately differs from the checkout estimate: the payment page must
    // display the confirmed server amount, including the final discount.
    totals: { subtotal: 150, discountAmount: 15, shippingCost: 10, totalToPay: 145 },
    payment: { method: "YAPE", receiptImageUrl: "" },
    paymentInstructions: {
      yapeName: "Cuenta de prueba E2E", yapeNumber: "900000002",
      plinName: "Cuenta de prueba E2E", plinNumber: "900000003",
    },
    publicWhatsapp: "51900000004",
    itemsSnapshots: [{ nameSnapshot: "Zapatilla de prueba E2E", qty: 1, unitPriceSnapshot: 150 }],
    shipping: {
      method: "LIMA_DELIVERY", receiverName: "Receptor de prueba", receiverDni: "00000000",
      receiverPhone: "900000001", district: "Miraflores", addressLine1: "Dirección ficticia 123",
    },
  };
}

type MockState = {
  order: ReturnType<typeof reservedOrder>;
  allowReservation: boolean;
  allowReceipt: boolean;
  reservations: Array<Record<string, any>>;
  receipts: Array<Record<string, any>>;
  uploads: number;
};

const states = new WeakMap<Page, MockState>();

test.describe("reserva antes del pago", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    const state: MockState = {
      order: reservedOrder(), allowReservation: false, allowReceipt: false,
      reservations: [], receipts: [], uploads: 0,
    };
    states.set(page, state);

    // This guard is installed for EVERY test, including read-only cases.
    await page.route(/\/api\/(create-order|submit-payment)\/?(?:\?.*)?$/, async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const payload = request.postDataJSON() as Record<string, any>;
      if (path.includes("create-order")) {
        state.reservations.push(payload);
        if (!state.allowReservation) {
          await route.fulfill({ status: 409, json: { error: "E2E_RESERVATION_BLOCKED" } });
          return;
        }
        await route.fulfill({ json: {
          orderId: state.order.orderId, publicCode: PUBLIC_CODE, trackingToken: TRACKING_TOKEN,
          reservedUntilMs: state.order.reservedUntilMs, totals: state.order.totals,
          trackingUrl: `/t/${PUBLIC_CODE}/${TRACKING_TOKEN}`, idempotent: false,
        } });
        return;
      }
      state.receipts.push(payload);
      if (!state.allowReceipt) {
        await route.fulfill({ status: 409, json: { error: "E2E_PAYMENT_BLOCKED" } });
        return;
      }
      state.order.status = "PAYMENT_SENT";
      state.order.payment.receiptImageUrl = String(payload.receiptImageUrl ?? "");
      await route.fulfill({ json: { ok: true, idempotent: false } });
    });
    await page.route(/\/api\/track\/?(?:\?.*)?$/, async (route) => {
      await route.fulfill({ json: state.order });
    });
    await page.route(/\/api\/products\/cart(?:\?.*)?$/, async (route) => {
      await route.fulfill({ json: {
        products: [{
          id: PRODUCT_ID, status: "active", name: "Zapatilla de prueba E2E", price: 150,
          onSale: false, images: [], variants: [{ id: VARIANT_ID, size: "42", color: "Negro", stock: 3 }],
        }],
        shipping: { baseCost: 10, freeShippingFrom: 200 },
      } });
    });
    await page.route("https://api.cloudinary.com/**", async (route) => {
      state.uploads += 1;
      await route.fulfill({
        headers: { "access-control-allow-origin": "*" },
        json: { secure_url: RECEIPT_URL },
      });
    });
    await page.route("https://res.cloudinary.com/e2e-testing/**", async (route) => {
      await route.fulfill({ contentType: "image/png", body: PNG });
    });
    await page.addInitScript(({ productId, variantId }) => {
      localStorage.setItem("odera_cart_v1", JSON.stringify([{ productId, variantId, qty: 1 }]));
    }, { productId: PRODUCT_ID, variantId: VARIANT_ID });
  });

  test("confirma stock antes de mostrar pago y envía el comprobante de la reserva", async ({ page }) => {
    const state = states.get(page)!;
    state.allowReservation = true;
    state.allowReceipt = true;
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Finalizar compra" })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByText("Cuenta de prueba E2E")).toHaveCount(0);
    expect(state.reservations).toHaveLength(0);
    expect(state.receipts).toHaveLength(0);

    const fields = {
      name: "Cliente de prueba", email: "checkout@example.test", phone: "900000001",
      receiverName: "Receptor de prueba", receiverDni: "00000000", receiverPhone: "900000001",
      district: "Miraflores", addressLine1: "Dirección ficticia 123",
    };
    for (const [id, value] of Object.entries(fields)) await page.locator(`#checkout-${id}`).fill(value);
    const reserve = page.getByRole("button", { name: "Reservar y continuar al pago" });
    await expect(reserve).toBeEnabled();
    await reserve.click();
    await expect(page).toHaveURL(new RegExp(`/checkout/pago\\?publicCode=${PUBLIC_CODE}&trackingToken=${TRACKING_TOKEN}$`));
    expect(state.reservations).toHaveLength(1);
    expect(state.reservations[0]).toMatchObject({
      items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, qty: 1 }],
      payment: { method: "YAPE" }, shipping: { method: "LIMA_DELIVERY" },
    });
    expect(state.reservations[0]).not.toHaveProperty("receiptImageUrl");
    expect(state.reservations[0]?.payment).not.toHaveProperty("receiptImageUrl");
    expect(state.receipts).toHaveLength(0);
    expect(state.uploads).toBe(0);

    const reservedSummary = page.getByRole("region", { name: "Tu pedido reservado" });
    await expect(reservedSummary.getByText("Total a pagar").locator("..")).toContainText(TOTAL_PATTERN);
    await expect(page.getByRole("status").filter({ hasText: "Tiempo restante:" })).toBeVisible();
    await expect(page.getByText("Cuenta de prueba E2E", { exact: true })).toBeVisible();
    const receiptInput = page.getByLabel("Imagen del comprobante", { exact: true });
    await expect(receiptInput).toBeEnabled();
    const submit = page.getByRole("button", { name: "Enviar comprobante", exact: true });
    await expect(submit).toBeDisabled();

    await receiptInput.setInputFiles({ name: "comprobante-e2e.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("Imagen cargada. Envíala para registrar el pago.")).toBeVisible();
    expect(state.uploads).toBe(1);
    await page.getByLabel("Código de operación (opcional)").fill("E2E-OP-1234");
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page).toHaveURL(new RegExp(`/confirm\\?publicCode=${PUBLIC_CODE}&trackingToken=${TRACKING_TOKEN}$`));
    await expect(page.getByRole("heading", { name: /pedido confirmado|comprobante recibido/i })).toBeVisible();
    expect(state.receipts).toEqual([{
      publicCode: PUBLIC_CODE, trackingToken: TRACKING_TOKEN,
      method: "YAPE", receiptImageUrl: RECEIPT_URL, operationCode: "E2E-OP-1234",
    }]);
    expect(state.reservations).toHaveLength(1);
  });

  test("una reserva vencida impide subir o enviar el pago", async ({ page }) => {
    const state = states.get(page)!;
    state.order.reservedUntilMs = Date.now() - 60_000;
    await page.goto(PAYMENT_PATH);
    await expect(page.getByText(/La reserva venció\. No realices el pago\./)).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enviar comprobante", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Contactar a la tienda" })).toBeVisible();
    expect(state.reservations).toHaveLength(0);
    expect(state.receipts).toHaveLength(0);
    expect(state.uploads).toBe(0);
  });

  test("un comprobante recibido no vuelve a pedir ni habilitar el pago", async ({ page }) => {
    const state = states.get(page)!;
    state.order.status = "PAYMENT_SENT";
    state.order.payment.receiptImageUrl = RECEIPT_URL;
    await page.goto(PAYMENT_PATH);
    await expect(page.getByText("Ya recibimos tu comprobante. Puedes consultar su validación en Seguimiento.")).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Enviar comprobante", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ver seguimiento del pedido" })).toHaveAttribute("href", `/track?publicCode=${PUBLIC_CODE}&trackingToken=${TRACKING_TOKEN}`);
    expect(state.reservations).toHaveLength(0);
    expect(state.receipts).toHaveLength(0);
    expect(state.uploads).toBe(0);
  });
});
