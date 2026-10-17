import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  safeParseMock: vi.fn(),
  verifyAppCheckIfEnabledMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getRequestIpMock: vi.fn(),
  getUserAgentMock: vi.fn(),
  sendTransactionalEmailMock: vi.fn(),
  runTransactionMock: vi.fn(),
  collectionDocMock: vi.fn(),
  collectionMock: vi.fn(),
}));

vi.mock("@/schemas/submitPayment", () => ({
  submitPaymentSchema: { safeParse: mocks.safeParseMock },
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

vi.mock("@/lib/server/email", () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmailMock,
}));

vi.mock("@/lib/server/firebaseAdmin", () => ({
  adminDb: {
    collection: mocks.collectionMock,
    runTransaction: mocks.runTransactionMock,
  },
}));

import { POST } from "./route";

function paymentPayload() {
  return {
    publicCode: "OD-0001",
    trackingToken: "TRACK",
    operationCode: "OP-123",
    method: "YAPE",
  };
}

function postPayment(payload: unknown) {
  mocks.safeParseMock.mockReturnValue({ success: true, data: payload });
  return POST(new Request("http://localhost/api/submit-payment", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

function installPaymentTransaction({
  orderOverrides = {},
  existingOperation,
}: {
  orderOverrides?: Record<string, unknown>;
  existingOperation?: { orderId: string };
} = {}) {
  const order = {
    trackingToken: "TRACK",
    status: "SCHEDULED",
    customer: { name: "Buyer", email: "buyer@test.com", phone: "999999999" },
    payment: { method: "YAPE" },
    reservedUntil: { toMillis: () => Date.now() + 60_000 },
    ...orderOverrides,
  };
  const refs = new Map<string, { id: string; path: string; set: ReturnType<typeof vi.fn> }>();
  function refFor(collection: string, id = "doc1") {
    const path = `${collection}/${id}`;
    if (!refs.has(path)) refs.set(path, { id, path, set: vi.fn() });
    return refs.get(path)!;
  }
  const query = { kind: "orders-query" };
  mocks.collectionMock.mockImplementation((collection: string) => ({
    doc: (id?: string) => refFor(collection, id),
    where: () => ({ limit: () => query }),
  }));
  const orderRef = refFor("orders", "order-1");
  const tx = {
    get: vi.fn(async (ref: { kind?: string; path?: string }) => {
      if (ref === query) return { empty: false, docs: [{ id: "order-1", ref: orderRef, data: () => order }] };
      if (ref.path?.startsWith("paymentOps/")) return { exists: Boolean(existingOperation), data: () => existingOperation };
      throw new Error(`Unexpected transaction read: ${ref.path}`);
    }),
    set: vi.fn(),
    update: vi.fn(),
  };
  mocks.runTransactionMock.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
  return { tx, orderRef, refFor };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.verifyAppCheckIfEnabledMock.mockResolvedValue(undefined);
  mocks.checkRateLimitMock.mockResolvedValue({ ok: true, resetAtMs: Date.now() + 60_000 });
  mocks.getRequestIpMock.mockReturnValue("127.0.0.1");
  mocks.getUserAgentMock.mockReturnValue("vitest");
  mocks.sendTransactionalEmailMock.mockResolvedValue({ ok: true });

  mocks.collectionDocMock.mockImplementation((id?: string) => ({
    id: id ?? "doc1",
    set: vi.fn(),
  }));
  mocks.collectionMock.mockReturnValue({ doc: mocks.collectionDocMock });
});

describe("POST /api/submit-payment", () => {
  it("acepta un comprobante sin código de operación y lo guarda para validar el pago", async () => {
    const { tx, orderRef } = installPaymentTransaction();
    const receiptImageUrl = "https://res.cloudinary.com/test/image/upload/receipt.jpg";
    const res = await postPayment({ publicCode: "OD-0001", trackingToken: "TRACK", method: "YAPE", receiptImageUrl });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, idempotent: false });
    expect(tx.update).toHaveBeenCalledWith(orderRef, expect.objectContaining({
      status: "PAYMENT_SENT",
      "payment.receiptImageUrl": receiptImageUrl,
      "payment.method": "YAPE",
      "payment.paymentSentAt": expect.anything(),
    }));
    expect(Object.keys(tx.update.mock.calls[0]![1])).not.toContain("payment.operationCode");
    expect(tx.set.mock.calls.some(([ref]) => ref.path.startsWith("paymentOps/"))).toBe(false);
    expect(mocks.sendTransactionalEmailMock).toHaveBeenCalledOnce();
  });

  it("repetir el mismo comprobante no vuelve a actualizar el pedido ni enviar correo", async () => {
    const receiptImageUrl = "https://res.cloudinary.com/test/image/upload/receipt.jpg";
    const { tx } = installPaymentTransaction({
      orderOverrides: { status: "PAYMENT_SENT", payment: { method: "YAPE", receiptImageUrl } },
    });
    const res = await postPayment({ publicCode: "OD-0001", trackingToken: "TRACK", method: "YAPE", receiptImageUrl });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, idempotent: true });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
    expect(mocks.sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("un código de operación ya registrado en ese pedido es idempotente", async () => {
    const { tx } = installPaymentTransaction({ existingOperation: { orderId: "order-1" } });
    const res = await postPayment(paymentPayload());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, idempotent: true });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
    expect(mocks.sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("rechaza un token inválido aunque exista la operación del pedido", async () => {
    const { tx } = installPaymentTransaction({ existingOperation: { orderId: "order-1" } });
    const res = await postPayment({ ...paymentPayload(), trackingToken: "WRONG_TOKEN" });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "INVALID_TRACKING_TOKEN" });
    expect(tx.get).toHaveBeenCalledTimes(1);
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("rechaza un código de operación usado en otro pedido", async () => {
    const { tx } = installPaymentTransaction({ existingOperation: { orderId: "other-order" } });
    const res = await postPayment(paymentPayload());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "OPERATION_CODE_ALREADY_USED" });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("rechaza reportar un pago nuevo cuando la reserva ya venció", async () => {
    const { tx } = installPaymentTransaction({ orderOverrides: { reservedUntil: { toMillis: () => Date.now() - 60_000 } } });
    const res = await postPayment({ publicCode: "OD-0001", trackingToken: "TRACK", method: "YAPE", receiptImageUrl: "https://example.com/receipt.jpg" });

    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "ORDER_EXPIRED" });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
    expect(mocks.sendTransactionalEmailMock).not.toHaveBeenCalled();
  });

  it("retorna 400 si falla validacion", async () => {
    mocks.safeParseMock.mockReturnValue({
      success: false,
      error: { issues: [{ path: ["publicCode"], message: "required" }] },
    });

    const req = new Request("http://localhost/api/submit-payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("VALIDATION_ERROR");
  });

  it("mapea ORDER_NOT_FOUND a 404", async () => {
    mocks.safeParseMock.mockReturnValue({ success: true, data: paymentPayload() });
    mocks.runTransactionMock.mockRejectedValue(new Error("ORDER_NOT_FOUND"));

    const req = new Request("http://localhost/api/submit-payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(paymentPayload()),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("ORDER_NOT_FOUND");
  });

  it("retorna 200 en flujo exitoso", async () => {
    mocks.safeParseMock.mockReturnValue({ success: true, data: paymentPayload() });
    mocks.runTransactionMock.mockResolvedValue({
      ok: true,
      idempotent: false,
      orderId: "order-1",
      customerEmail: "buyer@test.com",
      customerName: "Buyer",
      customerPhone: "999999999",
      publicCode: "OD-0001",
    });

    const req = new Request("http://localhost/api/submit-payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(paymentPayload()),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });
});
