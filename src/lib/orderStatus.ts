export type OrderStatus =
  | "SCHEDULED"
  | "PENDING_VALIDATION"
  | "PAYMENT_SENT"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "CANCELLED_EXPIRED";

export const ALLOWED_NEXT: Record<OrderStatus, OrderStatus[]> = {
  SCHEDULED: ["PAYMENT_SENT", "CANCELLED"],
  PENDING_VALIDATION: ["PAID", "CANCELLED"],
  PAYMENT_SENT: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  CANCELLED_EXPIRED: [],
};

export const EXPIRABLE_ORDER_STATUSES: OrderStatus[] = ["SCHEDULED", "PENDING_VALIDATION", "PAYMENT_SENT"];

export function isAllowedTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_NEXT[from].includes(to);
}

export function isOrderStatus(value: string): value is OrderStatus {
  return value in ALLOWED_NEXT;
}

export function isExpirableStatus(value: string): value is OrderStatus {
  return EXPIRABLE_ORDER_STATUSES.includes(value as OrderStatus);
}
