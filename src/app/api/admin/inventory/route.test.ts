import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(), verifyAdminSessionCookie: vi.fn(), collection: vi.fn(),
  orderBy: vi.fn(), where: vi.fn(), limit: vi.fn(), startAfter: vi.fn(), get: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/server/firebaseAdmin", () => ({ adminDb: { collection: mocks.collection } }));
vi.mock("@/lib/server/adminSession", () => ({ SESSION_COOKIE_NAME: "odera_session", verifyAdminSessionCookie: mocks.verifyAdminSessionCookie }));

import { GET } from "./route";

function product(index: number, deleted = false) {
  return {
    id: `product-${String(index).padStart(3, "0")}`,
    data: () => ({ name: `Product ${index}`, inventoryTotal: index, inventoryState: "HEALTHY", variants: [], ...(deleted ? { deletedAt: 1 } : {}) }),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  const query = { orderBy: mocks.orderBy, where: mocks.where, limit: mocks.limit, startAfter: mocks.startAfter, get: mocks.get };
  mocks.collection.mockReturnValue(query);
  mocks.orderBy.mockReturnValue(query);
  mocks.where.mockReturnValue(query);
  mocks.limit.mockReturnValue(query);
  mocks.startAfter.mockReturnValue(query);
  mocks.cookies.mockResolvedValue({ get: () => ({ value: "verified-admin-session" }) });
  mocks.verifyAdminSessionCookie.mockResolvedValue({ uid: "admin" });
});

describe("GET /api/admin/inventory", () => {
  it("keeps the look-ahead product for the next page rather than silently skipping it", async () => {
    const docs = Array.from({ length: 51 }, (_, index) => product(index + 1));
    mocks.get.mockResolvedValueOnce({ docs, size: docs.length });
    const first = await (await GET(new Request("https://example.test/api/admin/inventory"))).json();

    expect(first.items).toHaveLength(50);
    expect(first.items.at(-1).id).toBe("product-050");
    expect(JSON.parse(Buffer.from(first.nextCursor, "base64url").toString("utf8"))).toEqual({ total: 50, id: "product-050" });

    mocks.get.mockResolvedValueOnce({ docs: [product(51)], size: 1 });
    const second = await (await GET(new Request(`https://example.test/api/admin/inventory?cursor=${first.nextCursor}`))).json();
    expect(mocks.startAfter).toHaveBeenCalledWith(50, "product-050");
    expect(second.items[0].id).toBe("product-051");
    expect(second.nextCursor).toBeNull();
  });

  it("advances past scanned trash without skipping the next visible product", async () => {
    const docs = Array.from({ length: 51 }, (_, index) => product(index + 1, index === 49));
    mocks.get.mockResolvedValue({ docs, size: docs.length });
    const result = await (await GET(new Request("https://example.test/api/admin/inventory"))).json();
    expect(result.items).toHaveLength(49);
    expect(result.items.some((item: { id: string }) => item.id === "product-051")).toBe(false);
    expect(JSON.parse(Buffer.from(result.nextCursor, "base64url").toString("utf8"))).toEqual({ total: 50, id: "product-050" });
  });

  it.each([null, { total: -1, id: "product-001" }, { total: 1, id: "invalid/id" }, { total: "1", id: "product-001" }])("rejects malformed cursors before querying Firestore: %j", async (cursor) => {
    const encoded = Buffer.from(JSON.stringify(cursor)).toString("base64url");
    const response = await GET(new Request(`https://example.test/api/admin/inventory?cursor=${encoded}`));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "INVALID_CURSOR" });
    expect(mocks.collection).not.toHaveBeenCalled();
  });

  it("keeps the inventory private when no admin session exists", async () => {
    mocks.cookies.mockResolvedValue({ get: () => undefined });
    const response = await GET(new Request("https://example.test/api/admin/inventory"));
    expect(response.status).toBe(401);
    expect(mocks.collection).not.toHaveBeenCalled();
  });
});
