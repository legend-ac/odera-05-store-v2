export const SHIPPING_BASE_COST = 10;
export const DEFAULT_FREE_SHIPPING_FROM = 200;

export function shippingThreshold(value: unknown): number {
  const amount = Number(value ?? DEFAULT_FREE_SHIPPING_FROM);
  return Number.isFinite(amount) ? Math.max(0, amount) : DEFAULT_FREE_SHIPPING_FROM;
}

export function shippingCostFor(subtotal: number, freeFrom: unknown): number {
  return subtotal >= shippingThreshold(freeFrom) ? 0 : SHIPPING_BASE_COST;
}
