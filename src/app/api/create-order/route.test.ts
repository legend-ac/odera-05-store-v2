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
