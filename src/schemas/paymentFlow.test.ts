import { describe, expect, it } from "vitest";
import { createOrderSchema } from "./createOrder";
import { submitPaymentSchema } from "./submitPayment";

const reservation = {
  items: [{ productId: "p1", variantId: "v1", qty: 1 }],
  customer: { name: "Cliente", email: "cliente@example.com", phone: "999999999" },
  payment: { method: "YAPE" },
  shipping: {
    method: "LIMA_DELIVERY",
    receiverName: "Cliente",
    receiverDni: "12345678",
    receiverPhone: "999999999",
    district: "Lima",
    addressLine1: "Jirón Ejemplo 123",
  },
};

const paymentIdentity = { publicCode: "OD-0001", trackingToken: "VALID_TRACKING_TOKEN", method: "YAPE" };

describe("validación del flujo de reserva y pago", () => {
  it("permite reservar productos antes de contar con comprobante", () => {
    expect(createOrderSchema.safeParse(reservation).success).toBe(true);
  });

  it("acepta reportar pago con comprobante o código de operación", () => {
    expect(submitPaymentSchema.safeParse({ ...paymentIdentity, receiptImageUrl: "https://example.com/receipt.jpg" }).success).toBe(true);
    expect(submitPaymentSchema.safeParse({ ...paymentIdentity, operationCode: "123456" }).success).toBe(true);
  });

  it("rechaza reportar pago sin ninguna evidencia", () => {
    expect(submitPaymentSchema.safeParse(paymentIdentity).success).toBe(false);
  });

  it("rechaza un comprobante inválido o un código vacío", () => {
    expect(submitPaymentSchema.safeParse({ ...paymentIdentity, receiptImageUrl: "no-es-url" }).success).toBe(false);
    expect(submitPaymentSchema.safeParse({ ...paymentIdentity, operationCode: "   " }).success).toBe(false);
  });
});
