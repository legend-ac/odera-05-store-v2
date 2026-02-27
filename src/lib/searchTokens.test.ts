import { describe, expect, it } from "vitest";
import { makeProductSearchTokens, makeSearchTokens, normalizeToken } from "./searchTokens";

describe("search token generation", () => {
  it("normalizes accents and symbols", () => {
    expect(normalizeToken("Zapatillas Niño! Ñandú")).toBe("zapatillas nino nandu");
  });

  it("builds unique tokens with min length", () => {
    const tokens = makeSearchTokens("re re a b campUS campus");
    expect(tokens).toContain("re");
    expect(tokens).toContain("campus");
    expect(tokens).not.toContain("a");
    expect(tokens).not.toContain("b");
  });

  it("merges product fields into searchable tokens", () => {
    const tokens = makeProductSearchTokens({
      slug: "adidas-predator",
      name: "Adidas Predator",
      description: "Chimpunes futbol",
      brand: "ADIDAS",
      category: "Zapatillas",
    });
    expect(tokens).toContain("adidas");
    expect(tokens).toContain("predator");
    expect(tokens).toContain("futbol");
    expect(tokens).toContain("zapatillas");
  });
});

