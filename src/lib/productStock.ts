type VariantLike = { stock?: number | null };

export function getTotalStock(variants: VariantLike[] | undefined | null): number {
  if (!Array.isArray(variants) || variants.length === 0) return 0;
  return variants.reduce((acc, v) => acc + Math.max(0, Number(v?.stock ?? 0)), 0);
}

export function hasStock(variants: VariantLike[] | undefined | null): boolean {
  return getTotalStock(variants) > 0;
}

export function deriveStockDrivenStatus(
  currentStatus: "active" | "archived",
  variants: VariantLike[] | undefined | null,
  autoArchivedByStock?: boolean
): { status: "active" | "archived"; autoArchivedByStock: boolean; totalStock: number } {
  const totalStock = getTotalStock(variants);
  if (totalStock <= 0) {
    return { status: "archived", autoArchivedByStock: true, totalStock };
  }

  if (currentStatus === "archived" && autoArchivedByStock) {
    return { status: "active", autoArchivedByStock: false, totalStock };
  }

  return { status: currentStatus, autoArchivedByStock: Boolean(autoArchivedByStock), totalStock };
}

