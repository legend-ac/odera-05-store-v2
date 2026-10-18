import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), doc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (read: () => Promise<unknown>) => read }));
vi.mock("@/lib/server/firebaseAdmin", () => ({ adminDb: { doc: mocks.doc } }));

import { getStoreTheme } from "./storeTheme";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.doc.mockReturnValue({ get: mocks.get });
});

describe("apariencia inicial del servidor", () => {
  it("carga la selección clara guardada para el HTML inicial", async () => {
    mocks.get.mockResolvedValue({ data: () => ({ theme: "light" }) });
    expect(await getStoreTheme()).toBe("light");
    expect(mocks.doc).toHaveBeenCalledWith("settings/store");
  });

  it("mantiene el diseño existente con ajustes anteriores a la opción de tema", async () => {
    mocks.get.mockResolvedValue({ data: () => ({ storeName: "ODERA" }) });
    expect(await getStoreTheme()).toBe("dark");
  });

  it("mantiene la tienda disponible si falla la lectura opcional del tema", async () => {
    mocks.get.mockRejectedValue(new Error("Settings temporarily unavailable"));
    expect(await getStoreTheme()).toBe("dark");
  });
});
