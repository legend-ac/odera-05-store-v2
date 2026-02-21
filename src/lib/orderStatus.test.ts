import { describe, expect, it } from "vitest";
import { ALLOWED_NEXT, EXPIRABLE_ORDER_STATUSES, isAllowedTransition } from "./orderStatus";

describe("order status transitions", () => {
  it("allows only configured transitions", () => {
    expect(isAllowedTransition("PAID", "SHIPPED")).toBe(true);
    expect(isAllowedTransition("PAID", "DELIVERED")).toBe(false);
    expect(isAllowedTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("keeps admin transition source-of-truth centralized", () => {
    expect(ALLOWED_NEXT.PENDING_VALIDATION).toEqual(["PAID", "CANCELLED"]);
    expect(ALLOWED_NEXT.CANCELLED_EXPIRED).toEqual([]);
  });

  it("marks PENDING_VALIDATION as expirable by TTL", () => {
    expect(EXPIRABLE_ORDER_STATUSES).toContain("PENDING_VALIDATION");
  });
});
