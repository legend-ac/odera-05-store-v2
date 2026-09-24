import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  collectionMock: vi.fn(),
  docMock: vi.fn(),
  createMock: vi.fn(),
}));

vi.mock("@/lib/server/firebaseAdmin", () => ({
  adminDb: { collection: mocks.collectionMock },
}));

vi.mock("@/lib/server/random", () => ({ randomToken: vi.fn(() => "abc123") }));

import { POST } from "./route";

const validPayload = {
  kind: "RECLAMO",
  fullName: "Ana Pérez",
  documentNumber: "12345678",
  email: "ana@example.com",
  phone: "999888777",
  orderCode: "OD-123",
  detail: "El producto recibido no coincide con la talla solicitada.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collectionMock.mockReturnValue({ doc: mocks.docMock });
  mocks.docMock.mockReturnValue({ create: mocks.createMock });
});

describe("POST /api/consumer-claims", () => {
  it("rechaza solicitudes incompletas sin escribir en Firestore", async () => {
    const response = await POST(new NextRequest("http://localhost/api/consumer-claims", { method: "POST", body: JSON.stringify({ kind: "RECLAMO" }) }));

    expect(response.status).toBe(400);
    expect(mocks.collectionMock).not.toHaveBeenCalled();
  });

  it("registra un reclamo y devuelve un código de seguimiento", async () => {
    mocks.createMock.mockResolvedValue(undefined);

    const response = await POST(new NextRequest("http://localhost/api/consumer-claims", { method: "POST", body: JSON.stringify(validPayload) }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("LR-2026-ABC123");
    expect(mocks.collectionMock).toHaveBeenCalledWith("consumerClaims");
    expect(mocks.createMock).toHaveBeenCalledWith(expect.objectContaining({ ...validPayload, status: "RECIBIDO", code: "LR-2026-ABC123" }));
  });

  it("no revela errores internos cuando no se puede guardar", async () => {
    mocks.createMock.mockRejectedValue(new Error("Firestore unavailable"));

    const response = await POST(new NextRequest("http://localhost/api/consumer-claims", { method: "POST", body: JSON.stringify(validPayload) }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "No se pudo registrar el caso. Inténtalo nuevamente." });
  });
});
