import { describe, expect, it } from "vitest";
import { orderReservationNotice } from "./adminOrderPresentation";

describe("admin order reservation notice", () => {
  const now = 1_000_000;
  it.each(["PENDING_VALIDATION", "PAYMENT_SENT", "PAID", "SHIPPED", "DELIVERED"])(
    "never marks an order with a received payment as expired (%s)",
    (status) => expect(orderReservationNotice({ status, reservedUntilMs: now - 60_000 }, now)).toBeNull(),
  );
  it("shows the deadline only for an unpaid reservation", () => {
    expect(orderReservationNotice({ status: "SCHEDULED", reservedUntilMs: now + 1 }, now)).toBe("Reserva vence en 1 min");
    expect(orderReservationNotice({ status: "SCHEDULED", reservedUntilMs: now }, now)).toBe("Reserva vencida");
    expect(orderReservationNotice({ status: "SCHEDULED", reservedUntilMs: now + 16 * 60_000 }, now)).toBeNull();
    expect(orderReservationNotice({ status: "SCHEDULED", reservedUntilMs: null }, now)).toBeNull();
  });
});
