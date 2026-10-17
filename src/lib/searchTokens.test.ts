import { describe, expect, it } from "vitest";
import { getSearchTerms, makeProductSearchTokens, makeSearchTokens, normalizeToken, productMatchesSearch } from "./searchTokens";

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

  it("requires every query word instead of accepting only the brand", () => {
    const terms = getSearchTerms("Nike Air Max");
    expect(productMatchesSearch({ name: "Nike Air Max 90" }, terms)).toBe(true);
    expect(productMatchesSearch({ name: "Nike Air Force 1" }, terms)).toBe(false);
    expect(productMatchesSearch({ name: "Adidas Max Air" }, terms)).toBe(false);
  });

  it("matches words across fields with accents, punctuation and repeated query words", () => {
    const terms = getSearchTerms(" NIKE, niño fútbol NIKE ");
    expect(terms).toEqual(["nike", "nino", "futbol"]);
    expect(productMatchesSearch({ name: "Zapatilla niño", brand: "Nike", description: "Para fútbol" }, terms)).toBe(true);
    expect(productMatchesSearch({ name: "Nike para niño" }, terms)).toBe(false);
  });

  it("does not treat partial words as complete matches or discard single-character terms", () => {
    expect(productMatchesSearch({ name: "Nike Air Max" }, getSearchTerms("nik air"))).toBe(false);
    expect(productMatchesSearch({ name: "Nike Air Force 1" }, getSearchTerms("Nike 1"))).toBe(true);
    expect(productMatchesSearch({ name: "Nike Air Max 90" }, getSearchTerms("Nike 1"))).toBe(false);
  });

  it("checks complete product fields beyond the stored index's 30 terms", () => {
    const text = Array.from({ length: 35 }, (_, index) => `word${index}`).join(" ");
    expect(makeSearchTokens(text)).toHaveLength(30);
    expect(getSearchTerms(text)).toHaveLength(35);
    expect(productMatchesSearch({ description: text, searchTokens: makeSearchTokens(text) }, getSearchTerms("word0 word34"))).toBe(true);
    expect(productMatchesSearch({ name: "Nike", searchTokens: ["running"] }, getSearchTerms("nike running"))).toBe(true);
    expect(productMatchesSearch({ name: text }, getSearchTerms(`${text} missing`))).toBe(false);
  });
});

