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
