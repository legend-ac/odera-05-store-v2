import { describe, expect, it } from "vitest";
import { clampProductQuantity, initialProductVariant } from "./productSelection";

describe("product size and quantity selection", () => {
  it("starts with an available size when the first size is sold out", () => {
    expect(initialProductVariant([{ id: "40", stock: 0 }, { id: "41", stock: 3 }])).toBe("41");
    expect(initialProductVariant([])).toBe("");
    expect(initialProductVariant([{ id: "40", stock: 0 }])).toBe("40");
  });
  it("reduces the cart quantity when switching to a size with less stock", () => {
    expect(clampProductQuantity(5, 2)).toBe(2);
    expect(clampProductQuantity(5, 10)).toBe(5);
  });
  it("respects the checkout limit even for a size with plentiful stock", () => {
    expect(clampProductQuantity(100, 200)).toBe(50);
  });
  it.each([0, -1, NaN, Infinity])("keeps an invalid requested quantity usable: %s", (requested) => {
    expect(clampProductQuantity(requested, 5)).toBe(1);
  });
});
