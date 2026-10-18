type SelectableVariant = { id: string; stock: number };

export function initialProductVariant(variants: SelectableVariant[]): string {
  return variants.find((variant) => variant.stock > 0)?.id ?? variants[0]?.id ?? "";
}

/** Keep the quantity control valid; unavailable variants have a disabled CTA. */
export function clampProductQuantity(requested: number, stock: number): number {
  const limit = Number.isFinite(Number(stock)) ? Math.min(50, Math.max(1, Math.floor(Number(stock)))) : 1;
  const quantity = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 1;
  return Math.min(limit, quantity);
}
