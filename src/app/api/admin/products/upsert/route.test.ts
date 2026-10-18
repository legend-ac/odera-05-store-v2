import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), set: vi.fn(), session: vi.fn(), csrf: vi.fn(),
  cookie: vi.fn(), image: vi.fn(), transaction: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock("@/lib/server/adminSession", () => ({ SESSION_COOKIE_NAME: "session", verifyAdminSessionCookie: mocks.session }));
vi.mock("@/lib/server/csrf", () => ({ assertCsrfHeader: mocks.csrf }));
vi.mock("@/lib/server/storageAdapter", () => ({ assertImageUrlAllowed: mocks.image }));
vi.mock("@/lib/server/firebaseAdmin", () => ({ adminDb: {
  collection: (collection: string) => ({ doc: (id = "audit-1") => ({ id, collection }) }),
  runTransaction: mocks.transaction,
} }));
import { POST } from "./route";

const product = {
  slug: "modelo-prueba", productType: "zapatillas", audience: "todos", status: "active",
  name: "Modelo de prueba", description: "", brand: "Marca", category: "Urbano",
  price: 100, onSale: false, images: [], variants: [{ id: "v1", size: "40", stock: 5 }],
};
const request = (extra: Record<string, unknown> = {}) => new Request("https://example.test/api/admin/products/upsert", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...product, ...extra }),
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.cookie.mockReturnValue({ value: "session" });
  mocks.session.mockResolvedValue({ uid: "admin-test", email: "admin@example.test" });
  mocks.get.mockResolvedValue({ exists: false, data: () => undefined });
  mocks.transaction.mockImplementation((callback) => callback({ get: mocks.get, set: mocks.set }));
});

describe("admin product save safety", () => {
  it("creates a new product with inventory and audit metadata", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ productId: product.slug, status: "active", updatedAtMs: expect.any(Number) });
    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(mocks.set.mock.calls[0]?.[1]).toMatchObject({ inventoryTotal: 5, inventoryState: "HEALTHY" });
    expect(mocks.set.mock.calls[0]?.[1]).not.toHaveProperty("productId");
  });
  it("cannot overwrite an existing product by creating the same link", async () => {
    mocks.get.mockResolvedValue({ exists: true, data: () => product });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "PRODUCT_ALREADY_EXISTS" });
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("does not recreate a product deleted while the editor was open", async () => {
    const response = await POST(request({ productId: product.slug }));
    expect(response.status).toBe(404);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("does not replace inventory changed by another administrator", async () => {
    mocks.get.mockResolvedValue({ exists: true, data: () => ({ ...product, updatedAt: { toMillis: () => 2000 } }) });
    const response = await POST(request({ productId: product.slug, expectedUpdatedAtMs: 1000 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "PRODUCT_CHANGED" });
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("updates the original document and excludes editor metadata from storage", async () => {
    mocks.get.mockResolvedValue({ exists: true, data: () => ({ ...product, updatedAt: { toMillis: () => 2000 } }) });
    const response = await POST(request({ productId: "original-id", expectedUpdatedAtMs: 2000 }));
    expect(response.status).toBe(200);
    expect(mocks.set.mock.calls[0]?.[0]).toEqual({ id: "original-id", collection: "products" });
    expect(mocks.set.mock.calls[0]?.[1]).not.toHaveProperty("expectedUpdatedAtMs");
  });
  it("preserves automatic reactivation when an out-of-stock product is replenished", async () => {
    mocks.get.mockResolvedValue({ exists: true, data: () => ({ ...product, status: "archived", autoArchivedByStock: true }) });
    const response = await POST(request({ productId: product.slug, status: "archived" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "active", autoArchivedByStock: false });
  });
  it("preserves a manual archive when stock is available", async () => {
    mocks.get.mockResolvedValue({ exists: true, data: () => ({ ...product, status: "archived", autoArchivedByStock: false }) });
    const response = await POST(request({ productId: product.slug, status: "archived" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "archived", autoArchivedByStock: false });
  });
  it.each([
    { before: { ...product, deletedAt: true }, error: "PRODUCT_IN_TRASH" },
    { before: { ...product, slug: "otro-link" }, error: "PRODUCT_SLUG_LOCKED" },
  ])("rejects unsafe updates: $error", async ({ before, error }) => {
    mocks.get.mockResolvedValue({ exists: true, data: () => before });
    const response = await POST(request({ productId: product.slug }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error });
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it.each([
    { variants: [{ id: "v1", stock: 1 }, { id: "v1", stock: 2 }] },
    { variants: [{ id: "v1", stock: 1.5 }] },
    { onSale: true, salePrice: 100 },
    { onSale: true, salePrice: 0 },
    { images: [{ url: "a", isMain: true, order: 0 }, { url: "b", isMain: true, order: 1 }] },
  ])("rejects invalid variants, prices or main images before writes: %j", async (extra) => {
    const response = await POST(request(extra));
    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("still requires an administrator session", async () => {
    mocks.cookie.mockReturnValue(undefined);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
