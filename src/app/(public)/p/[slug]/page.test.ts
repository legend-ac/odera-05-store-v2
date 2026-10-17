import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("react", () => ({ cache: (callback: unknown) => callback }));
vi.mock("@/lib/server/firebaseAdmin", () => ({ adminDb: { doc: () => ({ get: mocks.get }) } }));
vi.mock("./product-client", () => ({ default: () => null }));

import { generateMetadata } from "./page";

beforeEach(() => vi.clearAllMocks());

describe("product page metadata visibility", () => {
  it("reads real public product data", async () => {
    mocks.get.mockResolvedValue({ exists: true, id: "p1", data: () => ({ name: "Zapatillas Nike", status: "active", variants: [{ stock: 2 }], images: [] }) });
    expect((await generateMetadata({ params: Promise.resolve({ slug: "p1" }) })).title).toBe("Zapatillas Nike");
  });

  it.each([
    { status: "archived", variants: [{ stock: 2 }] },
    { status: "active", variants: [{ stock: 0 }] },
  ])("does not expose metadata from an unavailable product: %j", async (availability) => {
    mocks.get.mockResolvedValue({ exists: true, id: "p1", data: () => ({ ...availability, name: "Private product name", description: "Private description", images: [] }) });
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "p1" }) });
    expect(metadata.title).toBe("Producto no disponible");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(JSON.stringify(metadata)).not.toContain("Private");
  });

  it("marks missing products as unavailable", async () => {
    mocks.get.mockResolvedValue({ exists: false });
    expect((await generateMetadata({ params: Promise.resolve({ slug: "missing" }) })).robots).toEqual({ index: false, follow: true });
  });
});
