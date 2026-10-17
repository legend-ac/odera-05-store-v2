import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  safeParseMock: vi.fn(),
  verifyAppCheckIfEnabledMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getRequestIpMock: vi.fn(),
  getUserAgentMock: vi.fn(),
  randomTokenMock: vi.fn(),
  sendTransactionalEmailMock: vi.fn(),
  getServerEnvMock: vi.fn(),
  runTransactionMock: vi.fn(),
  docGetMock: vi.fn(),
  collectionDocMock: vi.fn(),
  collectionMock: vi.fn(),
  docMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/schemas/createOrder", () => ({
  createOrderSchema: { safeParse: mocks.safeParseMock },
}));

vi.mock("@/lib/server/appCheckVerify", () => ({
  verifyAppCheckIfEnabled: mocks.verifyAppCheckIfEnabledMock,
}));

vi.mock("@/lib/server/rateLimit", () => ({
  checkRateLimit: mocks.checkRateLimitMock,
}));

vi.mock("@/lib/server/ip", () => ({
  getRequestIp: mocks.getRequestIpMock,
  getUserAgent: mocks.getUserAgentMock,
}));

vi.mock("@/lib/server/random", () => ({
  randomToken: mocks.randomTokenMock,
}));

vi.mock("@/lib/server/email", () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmailMock,
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: mocks.getServerEnvMock,
}));

vi.mock("@/lib/server/firebaseAdmin", () => ({
  adminDb: {
    collection: mocks.collectionMock,
    doc: mocks.docMock,
    runTransaction: mocks.runTransactionMock,
  },
}));

import { POST } from "./route";

function basePayload() {
  return {
    items: [{ productId: "p1", variantId: "v1", qty: 1 }],
    customer: { name: "Andy", email: "a@test.com", phone: "999999999" },
    payment: { method: "YAPE", receiptImageUrl: "https://example.com/r.jpg" },
    shipping: {
      method: "LIMA_DELIVERY",
      receiverName: "Andy",
      receiverDni: "12345678",
      receiverPhone: "999999999",
      district: "Lima",
      addressLine1: "Jr Test 123",
    },
    couponCode: "",
  };
}

function postOrder(payload: unknown, idempotencyKey?: string) {
  mocks.safeParseMock.mockReturnValue({ success: true, data: payload });
  return POST(new Request("http://localhost/api/create-order", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  }));
}

function installReservationTransaction({
  stock = 5,
  existingOperation,
  existingOrder,
}: {
  stock?: number;
  existingOperation?: Record<string, unknown>;
  existingOrder?: Record<string, unknown>;
} = {}) {
  const product = {
    name: "Zapatilla de prueba",
    price: 100,
    onSale: false,
    status: "active",
    variants: [
      { id: "v1", size: "40", stock },
      { id: "v2", size: "41", stock: 4 },
    ],
    images: [],
  };
  const refs = new Map<string, { id: string; path: string; set: ReturnType<typeof vi.fn> }>();
  function refFor(collection: string, id = "doc1") {
    const path = `${collection}/${id}`;
    if (!refs.has(path)) refs.set(path, { id, path, set: vi.fn() });
    return refs.get(path)!;
  }
  mocks.collectionMock.mockImplementation((collection: string) => ({
    doc: (id?: string) => refFor(collection, id),
  }));
  const tx = {
    get: vi.fn(async (ref: { path: string }) => {
      if (ref.path === "products/p1") return { exists: true, ref, data: () => product };
      if (ref.path === "counters/orders") return { exists: true, ref, data: () => ({ seq: 12 }) };
      if (ref.path.startsWith("orderOps/")) return { exists: Boolean(existingOperation), ref, data: () => existingOperation };
      if (ref.path === `orders/${existingOperation?.orderId}`) return {
        exists: true,
        ref,
        data: () => existingOrder ?? { status: "SCHEDULED", reservedUntil: { toMillis: () => existingOperation!.reservedUntilMs } },
      };
      throw new Error(`Unexpected transaction read: ${ref.path}`);
    }),
    set: vi.fn(),
    update: vi.fn(),
  };
  mocks.runTransactionMock.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
  return { tx, product, refFor };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.verifyAppCheckIfEnabledMock.mockResolvedValue(undefined);
  mocks.checkRateLimitMock.mockResolvedValue({ ok: true, resetAtMs: Date.now() + 60_000 });
  mocks.getRequestIpMock.mockReturnValue("127.0.0.1");
  mocks.getUserAgentMock.mockReturnValue("vitest");
  mocks.randomTokenMock.mockReturnValue("TRACK_TOKEN");
  mocks.sendTransactionalEmailMock.mockResolvedValue({ ok: true });
  mocks.getServerEnvMock.mockReturnValue({ SMTP_USER: "store@test.com" });

  mocks.docGetMock.mockResolvedValue({ exists: false, data: () => ({}) });
  mocks.docMock.mockReturnValue({ get: mocks.docGetMock });

  mocks.collectionDocMock.mockImplementation((id?: string) => ({ id: id ?? "doc1", set: vi.fn() }));
  mocks.collectionMock.mockReturnValue({ doc: mocks.collectionDocMock });
});

describe("POST /api/create-order", () => {
  it("reserva sin comprobante, conserva ambas deducciones de tallas y calcula el total antes del pago", async () => {
    const { tx, product, refFor } = installReservationTransaction();
    const payload = {
      ...basePayload(),
      payment: { method: "YAPE" },
      items: [
        { productId: "p1", variantId: "v1", qty: 2 },
        { productId: "p1", variantId: "v2", qty: 1 },
      ],
    };
    const beforeRequest = Date.now();
    const res = await postOrder(payload);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ publicCode: "OD-0013", trackingToken: "TRACK_TOKEN", totalToPay: 300, shippingCost: 0, idempotent: false });
    expect(json.reservedUntilMs).toBeGreaterThanOrEqual(beforeRequest + 20 * 60 * 1000);
    expect(tx.get.mock.calls.filter(([ref]) => ref.path === "products/p1")).toHaveLength(1);
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.update).toHaveBeenCalledWith(refFor("products", "p1"), expect.objectContaining({
      variants: [
        { id: "v1", size: "40", stock: 3 },
        { id: "v2", size: "41", stock: 3 },
      ],
      inventoryTotal: 6,
    }));
    expect(product.variants.map(variant => variant.stock)).toEqual([5, 4]);
    expect(tx.set).toHaveBeenCalledWith(refFor("orders"), expect.objectContaining({
      status: "SCHEDULED",
      payment: { method: "YAPE" },
      totals: { subtotal: 300, discountAmount: 0, shippingCost: 0, totalToPay: 300 },
      itemsSnapshots: expect.arrayContaining([
        expect.objectContaining({ variantSnapshot: expect.objectContaining({ id: "v1" }), qty: 2 }),
        expect.objectContaining({ variantSnapshot: expect.objectContaining({ id: "v2" }), qty: 1 }),
      ]),
    }));
    expect(mocks.sendTransactionalEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      to: "a@test.com",
      text: expect.stringContaining("Realiza el pago después de comprobar el total y la vigencia de tu reserva"),
    }));
  });

  it("rechaza stock insuficiente antes de crear la reserva o descontar existencias", async () => {
    const { tx, refFor } = installReservationTransaction({ stock: 0 });
    const res = await postOrder({ ...basePayload(), payment: { method: "YAPE" } });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "OUT_OF_STOCK" });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set.mock.calls.some(([ref]) => ref === refFor("orders"))).toBe(false);
    expect(mocks.sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("reutiliza una reserva idempotente sin volver a descontar stock ni enviar correos", async () => {
    const existing = {
      orderId: "existing-order",
      publicCode: "OD-0008",
      trackingToken: "EXISTING_TOKEN",
      reservedUntilMs: Date.now() + 60_000,
      shippingCost: 10,
      discountAmount: 0,
      totalToPay: 110,
    };
    const { tx } = installReservationTransaction({ existingOperation: existing });
    const res = await postOrder({ ...basePayload(), payment: { method: "YAPE" } }, "repeat-reservation");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ...existing, idempotent: true });
    expect(tx.get).toHaveBeenCalledTimes(2);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(mocks.sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it.each([
    { status: "SCHEDULED", responseStatus: 410, error: "ORDER_EXPIRED" },
    { status: "CANCELLED_EXPIRED", responseStatus: 410, error: "ORDER_EXPIRED" },
    { status: "EXPIRED", responseStatus: 410, error: "ORDER_EXPIRED" },
    { status: "CANCELLED", responseStatus: 409, error: "ORDER_CANCELLED" },
  ])("no devuelve como vigente una reserva idempotente $status vencida o cancelada", async ({ status, responseStatus, error }) => {
    const { tx } = installReservationTransaction({
      existingOperation: {
        orderId: "existing-order",
        publicCode: "OD-0008",
        trackingToken: "EXISTING_TOKEN",
        reservedUntilMs: Date.now() + 60_000,
      },
      existingOrder: { status, reservedUntil: { toMillis: () => Date.now() - 60_000 } },
    });
    const res = await postOrder({ ...basePayload(), payment: { method: "YAPE" } }, "expired-reservation");

    expect(res.status).toBe(responseStatus);
    expect(await res.json()).toEqual({ error });
    expect(tx.get).toHaveBeenCalledTimes(2);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(mocks.sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it.each(["PAYMENT_SENT", "PENDING_VALIDATION", "PAID"])("reutiliza el pedido %s sin aplicar el vencimiento de la reserva previa al pago", async (status) => {
    const existingOperation = {
      orderId: "existing-order",
      publicCode: "OD-0008",
      trackingToken: "EXISTING_TOKEN",
      reservedUntilMs: Date.now() - 60_000,
      shippingCost: 10,
      discountAmount: 0,
      totalToPay: 110,
    };
    const { tx } = installReservationTransaction({
      existingOperation,
      existingOrder: { status, reservedUntil: { toMillis: () => existingOperation.reservedUntilMs } },
    });
    const res = await postOrder({ ...basePayload(), payment: { method: "YAPE" } }, "paid-reservation");

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ...existingOperation, idempotent: true });
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(mocks.sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("retorna 400 si falla validacion", async () => {
    mocks.safeParseMock.mockReturnValue({
      success: false,
      error: { issues: [{ path: ["items"], message: "required" }] },
    });

    const req = new Request("http://localhost/api/create-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("VALIDATION_ERROR");
  });

  it("mapea PRODUCT_NOT_FOUND a 404", async () => {
    mocks.safeParseMock.mockReturnValue({ success: true, data: basePayload() });
    mocks.runTransactionMock.mockRejectedValue(new Error("PRODUCT_NOT_FOUND:p1"));

    const req = new Request("http://localhost/api/create-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(basePayload()),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("PRODUCT_NOT_FOUND");
  });

  it("mapea OUT_OF_STOCK a 409", async () => {
    mocks.safeParseMock.mockReturnValue({ success: true, data: basePayload() });
    mocks.runTransactionMock.mockRejectedValue(new Error("OUT_OF_STOCK:p1:v1"));

    const req = new Request("http://localhost/api/create-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(basePayload()),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.error).toBe("OUT_OF_STOCK");
  });
});
