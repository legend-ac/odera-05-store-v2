export type PaymentSubmitDecision =
  | "ALLOW"
  | "IDEMPOTENT"
  | "ORDER_CANCELLED"
  | "ORDER_ALREADY_FINAL"
  | "PAYMENT_ALREADY_SENT";

export function decidePaymentSubmission(
  status: string,
  existingOperationCode: string | undefined,
  incomingOperationCode: string
): PaymentSubmitDecision {
  if (status === "CANCELLED" || status === "CANCELLED_EXPIRED") return "ORDER_CANCELLED";
  if (status === "PAID" || status === "SHIPPED" || status === "DELIVERED") return "ORDER_ALREADY_FINAL";

  if (status === "PAYMENT_SENT") {
    if (existingOperationCode === incomingOperationCode) return "IDEMPOTENT";
    return "PAYMENT_ALREADY_SENT";
  }

  return "ALLOW";
}
