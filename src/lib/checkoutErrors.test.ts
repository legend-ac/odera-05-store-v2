import { describe, expect, it } from "vitest";
import { checkoutErrorMessage } from "./checkoutErrors";

describe("mensajes de compra", () => {
  it("explica cómo corregir stock insuficiente sin mostrar identificadores internos", () => {
    const message = checkoutErrorMessage("OUT_OF_STOCK:internal-product:internal-variant");
    expect(message).toContain("carrito");
    expect(message).toContain("cantidades antes de pagar");
    expect(message).not.toContain("internal-product");
  });

  it("indica qué hacer si se pagó después de vencer o cancelar la reserva", () => {
    for (const code of ["ORDER_EXPIRED", "ORDER_CANCELLED"]) {
      const message = checkoutErrorMessage(code);
      expect(message).toContain("No realices el pago");
      expect(message).toContain("Si ya pagaste");
      expect(message).toContain("número de pedido");
    }
  });

  it("un error desconocido dirige al seguimiento antes de duplicar un pedido", () => {
    const message = checkoutErrorMessage("UNEXPECTED_BACKEND_CODE");
    expect(message).toContain("consulta su seguimiento antes de crear otro");
    expect(message).not.toContain("UNEXPECTED_BACKEND_CODE");
  });
});
