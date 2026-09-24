type VariantLike = { stock?: number | null };

/**
 * These fields are deliberately stored on the product document as well as
 * being derivable from variants.  A catalogue can render from variants, but
 * an operations screen needs to sort and filter thousands of products without
 * downloading every variant first.
 */
export type InventoryState = "OUT" | "LOW" | "HEALTHY";

export type InventorySummary = {
  inventoryTotal: number;
  inventoryState: InventoryState;
};

export const LOW_STOCK_THRESHOLD = 3;

export function getTotalStock(variants: VariantLike[] | undefined | null): number {
  if (!Array.isArray(variants) || variants.length === 0) return 0;
  return variants.reduce((acc, v) => acc + Math.max(0, Number(v?.stock ?? 0)), 0);
}

export function hasStock(variants: VariantLike[] | undefined | null): boolean {
  return getTotalStock(variants) > 0;
}

export function getInventorySummary(variants: VariantLike[] | undefined | null): InventorySummary {
  const inventoryTotal = getTotalStock(variants);
  return {
    inventoryTotal,
    inventoryState: inventoryTotal === 0 ? "OUT" : inventoryTotal <= LOW_STOCK_THRESHOLD ? "LOW" : "HEALTHY",
  };
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
