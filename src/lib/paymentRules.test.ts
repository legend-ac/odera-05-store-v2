import { describe, expect, it } from "vitest";
import { decidePaymentSubmission } from "./paymentRules";

describe("submit-payment idempotency and guards", () => {
  it("returns idempotent for PAYMENT_SENT with same operation code", () => {
    const result = decidePaymentSubmission("PAYMENT_SENT", "OP-123", "OP-123");
    expect(result).toBe("IDEMPOTENT");
  });

  it("rejects reused operation code mismatch for PAYMENT_SENT", () => {
    const result = decidePaymentSubmission("PAYMENT_SENT", "OP-123", "OP-999");
    expect(result).toBe("PAYMENT_ALREADY_SENT");
  });

  it("allows new submission on pending states", () => {
    expect(decidePaymentSubmission("SCHEDULED", undefined, "OP-1")).toBe("ALLOW");
    expect(decidePaymentSubmission("PENDING_VALIDATION", undefined, "OP-1")).toBe("ALLOW");
  });
});
