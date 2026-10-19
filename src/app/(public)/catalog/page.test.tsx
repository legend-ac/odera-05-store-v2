import React from "react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// The app uses Next's automatic JSX runtime; this Node-only test runner uses
// classic JSX unless a browser plugin is installed.
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

const mocks = vi.hoisted(() => ({
  collection: vi.fn(), doc: vi.fn(), initialGet: vi.fn(), searchGet: vi.fn(), settingsGet: vi.fn(),
  where: vi.fn(), limit: vi.fn(), startAfter: vi.fn(),
}));

vi.mock("@/lib/server/firebaseAdmin", () => ({ adminDb: { collection: mocks.collection, doc: mocks.doc } }));
vi.mock("next/cache", () => ({ unstable_cache: (read: (...args: any[]) => Promise<unknown>) => read }));
vi.mock("./catalog-client", () => ({ default: () => null }));

import CatalogPage from "./page";

function product(id: string, extra: Record<string, unknown> = {}) {
  const data = {
    name: id, slug: id, price: 150, status: "active", productType: "zapatillas", audience: "todos",
    variants: [{ id: "42", stock: 1 }], updatedAt: { toMillis: () => 10 },
    images: [{ url: `https://images.example.test/${id}.jpg`, order: 0, isMain: true }],
    ...extra,
  };
  return { id, data: () => data };
}

function snapshot(docs: ReturnType<typeof product>[]) { return { docs, size: docs.length }; }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.collection.mockImplementation(() => {
    const query = {
      searching: false,
      where(field: string, operator: string, value: unknown) {
        mocks.where(field, operator, value);
        if (field === "searchTokens") this.searching = true;
        return this;
      },
      limit(count: number) {
        mocks.limit(count);
        return { ...this, get: count === 150 ? mocks.initialGet : mocks.searchGet };
      },
      startAfter(cursor: unknown) { mocks.startAfter(cursor); return this; },
    };
    return query;
  });
  mocks.doc.mockReturnValue({ get: mocks.settingsGet });
  mocks.initialGet.mockResolvedValue(snapshot([product("initial")]));
  mocks.searchGet.mockResolvedValue(snapshot([]));
  mocks.settingsGet.mockResolvedValue({ exists: true, data: () => ({ productTypes: [{ key: "zapatillas", label: "Zapatillas", enabled: true }] }) });
});

describe("server-rendered catalog", () => {
  it("supplies the first HTML with the latest in-stock deduplicated catalog and configured filters", async () => {
    const available = Array.from({ length: 52 }, (_, index) => product(`p-${index}`, { updatedAt: { toMillis: () => index } }));
    mocks.initialGet.mockResolvedValue(snapshot([
      ...available,
      product("out-of-stock", { variants: [{ stock: 0 }], updatedAt: { toMillis: () => 999 } }),
      product("newest-duplicate", { slug: "p-0", updatedAt: { toMillis: () => 99 } }),
    ]));
    const rendered = await CatalogPage({ searchParams: Promise.resolve({}) });
    expect(rendered.props.initialItems).toHaveLength(50);
    expect(rendered.props.initialItems[0].id).toBe("newest-duplicate");
    expect(rendered.props.initialItems.some((item: { id: string }) => ["out-of-stock", "p-0"].includes(item.id))).toBe(false);
    expect(rendered.props.productTypes).toEqual([{ key: "zapatillas", label: "Zapatillas" }]);
    expect(mocks.where).toHaveBeenCalledWith("status", "==", "active");
    expect(mocks.limit).toHaveBeenCalledWith(150);
    expect(mocks.searchGet).not.toHaveBeenCalled();
  });

  it("passes the first URL values to the initial render without a client search-params bailout", async () => {
    const rendered = await CatalogPage({ searchParams: Promise.resolve({ type: ["ropa", "zapatillas"], audience: "mujer", q: ["", "ignored"] }) });
    expect(rendered.props.routeType).toBe("ropa");
    expect(rendered.props.routeAudience).toBe("mujer");
    expect(rendered.props.routeQuery).toBe("");
    expect(rendered.props.initialSearchItems).toBeUndefined();
  });

  it("searches every indexed page with all terms before selecting latest in-stock results", async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => product(`nike-${index}`, { name: "Nike", brand: "Nike", searchTokens: ["nike"] }));
    const matching = product("matching", { name: "Nike Air", audience: "Niñas", searchTokens: ["nike", "air"], updatedAt: { toMillis: () => 100 } });
    const sold = product("sold", { name: "Nike Air", searchTokens: ["nike", "air"], variants: [{ stock: 0 }] });
    mocks.searchGet.mockResolvedValueOnce(snapshot(firstPage)).mockResolvedValueOnce(snapshot([matching, sold]));
    const rendered = await CatalogPage({ searchParams: Promise.resolve({ q: "NÍKE AIR", type: "zapatillas", audience: "ninos" }) });
    expect(mocks.where).toHaveBeenCalledWith("searchTokens", "array-contains", "nike");
    expect(mocks.searchGet).toHaveBeenCalledTimes(2);
    expect(mocks.startAfter).toHaveBeenCalledWith(firstPage[49]);
    expect(rendered.props.initialSearchItems).toEqual([expect.objectContaining({ id: "matching", audience: "ninos" })]);
    expect(rendered.props.initialItems[0].id).toBe("initial");
    expect(rendered.props.routeQuery).toBe("NÍKE AIR");
  });

  it("keeps optional settings and failed search recoverable without losing the base catalog", async () => {
    mocks.settingsGet.mockRejectedValue(new Error("Settings unavailable"));
    mocks.searchGet.mockRejectedValue(new Error("Search unavailable"));
    const rendered = await CatalogPage({ searchParams: Promise.resolve({ q: "nike" }) });
    expect(rendered.props.initialSearchItems).toBeUndefined();
    expect(rendered.props.initialItems).toEqual([expect.objectContaining({ id: "initial" })]);
    expect(rendered.props.productTypes.map((item: { key: string }) => item.key)).toEqual(["zapatillas", "ropa", "accesorios"]);
  });
});
