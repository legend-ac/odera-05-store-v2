export function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function makeSearchTokens(input: string): string[] {
  return getSearchTerms(input).filter((part) => part.length >= 2).slice(0, 30);
}

/** Query terms must not inherit the stored index's 30-token limit. */
export function getSearchTerms(input: string): string[] {
  return Array.from(new Set(normalizeToken(input).split(/\s+/g).filter(Boolean)));
}

export function productMatchesSearch(
  product: {
    slug?: unknown;
    name?: unknown;
    description?: unknown;
    brand?: unknown;
    category?: unknown;
    searchTokens?: unknown;
  },
  terms: readonly string[]
): boolean {
  const indexedTokens = Array.isArray(product.searchTokens) ? product.searchTokens : [];
  const searchable = [
    product.slug, product.name, product.description, product.brand, product.category,
    ...indexedTokens,
  ].map((value) => String(value ?? "")).join(" ");
  const available = new Set(getSearchTerms(searchable));
  return terms.every((term) => available.has(term));
}

export function makeProductSearchTokens(args: {
  slug: string;
  name: string;
  description: string;
  brand: string;
  category: string;
}): string[] {
  const combined = [args.slug, args.name, args.description, args.brand, args.category].join(" ");
  return makeSearchTokens(combined);
}
