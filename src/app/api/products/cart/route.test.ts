import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  collectionMock: vi.fn(),
  docMock: vi.fn(),
  getAllMock: vi.fn(),
}));

vi.mock("@/lib/server/firebaseAdmin", () => ({
  adminDb: {
    collection: mocks.collectionMock,
    getAll: mocks.getAllMock,
  },
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collectionMock.mockReturnValue({ doc: mocks.docMock });
  mocks.docMock.mockImplementation((id: string) => ({ id }));
});

describe("GET /api/products/cart", () => {
  it("ignora identificadores inválidos sin consultar Firestore", async () => {
    const response = await GET(new NextRequest("http://localhost/api/products/cart?ids=../../secret,!!"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ products: [] });
    expect(mocks.getAllMock).not.toHaveBeenCalled();
  });

  it("devuelve los datos mínimos que necesita el carrito", async () => {
    mocks.getAllMock.mockResolvedValue([
      {
        id: "carina-lift-mono",
        exists: true,
        data: () => ({
          name: "Carina Lift Mono",
          price: 259,
          salePrice: 150,
          onSale: true,
          images: [{ url: "https://cdn.example/carina.webp", isMain: true, order: 0 }],
          variants: [{ id: "default", size: "37", stock: 1 }],
        }),
      },
    ]);

    const response = await GET(new NextRequest("http://localhost/api/products/cart?ids=carina-lift-mono"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products).toEqual([{
      id: "carina-lift-mono",
      name: "Carina Lift Mono",
      price: 259,
      salePrice: 150,
      onSale: true,
      images: [{ url: "https://cdn.example/carina.webp", isMain: true, order: 0 }],
      variants: [{ id: "default", size: "37", stock: 1 }],
    }]);
  });

  it("no filtra errores internos al navegador", async () => {
    mocks.getAllMock.mockRejectedValue(new Error("Firestore unavailable"));

    const response = await GET(new NextRequest("http://localhost/api/products/cart?ids=carina-lift-mono"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "No se pudo cargar el carrito." });
  });
});
