import { describe, expect, it } from "vitest";
import { normalizeStoreTheme } from "./storeTheme";

describe("tema de la tienda", () => {
  it("acepta ambas variantes de apariencia", () => {
    expect(normalizeStoreTheme("light")).toBe("light");
    expect(normalizeStoreTheme("dark")).toBe("dark");
  });

  it.each([undefined, null, "", "LIGHT", "cream", false, {}])("conserva el tema existente si no hay un valor válido", value => {
    expect(normalizeStoreTheme(value)).toBe("dark");
  });
});
