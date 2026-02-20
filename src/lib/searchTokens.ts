export function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function makeSearchTokens(input: string): string[] {
  const normalized = normalizeToken(input);
  if (!normalized) return [];
  const parts = normalized.split(/\s+/g).filter(Boolean);
  const uniq = new Set<string>();
  for (const p of parts) {
    if (p.length < 2) continue;
    uniq.add(p);
  }
  return Array.from(uniq).slice(0, 30);
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
