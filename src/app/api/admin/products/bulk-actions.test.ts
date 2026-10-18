import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), delete: vi.fn(), set: vi.fn(), commit: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("@/lib/server/adminSession", () => ({ SESSION_COOKIE_NAME: "session", verifyAdminSessionCookie: async () => ({ uid: "admin" }) }));
vi.mock("@/lib/server/csrf", () => ({ assertCsrfHeader: async () => {} }));
vi.mock("@/lib/server/firebaseAdmin", () => ({ adminDb: {
  collection: () => ({ orderBy: () => ({ limit: () => ({ get: mocks.get }) }), doc: () => ({ id: "audit" }) }),
  batch: () => ({ update: mocks.update, delete: mocks.delete, set: mocks.set, commit: mocks.commit }),
} }));
import { POST as trash } from "./bulk-delete/route";
import { POST as purge } from "./bulk-purge/route";

beforeEach(() => vi.resetAllMocks());
const request = (limit?: number) => new Request("https://example.test/api/admin/products/bulk", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ limit }),
});

describe.each([{ name: "trash", handler: trash, deleted: false }, { name: "purge", handler: purge, deleted: true }])("product bulk $name", ({ handler, deleted }) => {
  it("keeps product and audit writes within one batch and returns the actual affected IDs", async () => {
    mocks.get.mockResolvedValue({ docs: Array.from({ length: 300 }, (_, i) => ({
      id: `p-${i}`, ref: { id: `p-${i}` }, data: () => ({ status: "archived", deletedAt: deleted ? 1 : null }),
    })) });
    const response = await handler(request(250));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.processedIds).toHaveLength(250);
    expect(result.processedIds.at(-1)).toBe("p-249");
    expect(mocks.set.mock.calls.length + mocks.update.mock.calls.length + mocks.delete.mock.calls.length).toBe(500);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("rejects operations that would exceed the batch write limit", async () => {
    const response = await handler(request(500));
    expect(response.status).toBe(400);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
