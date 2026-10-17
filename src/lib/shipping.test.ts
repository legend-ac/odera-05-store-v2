import { describe, expect, it } from "vitest";
import { shippingCostFor, shippingThreshold } from "./shipping";

describe("costo de envío", () => {
  it("cobra S/10 por debajo del mínimo y aplica envío gratis desde el importe exacto", () => {
    expect(shippingCostFor(199.99, undefined)).toBe(10);
    expect(shippingCostFor(200, undefined)).toBe(0);
    expect(shippingCostFor(250, undefined)).toBe(0);
  });

  it("respeta el mínimo configurado por la tienda", () => {
    expect(shippingThreshold("300")).toBe(300);
    expect(shippingCostFor(299.99, "300")).toBe(10);
    expect(shippingCostFor(300, "300")).toBe(0);
  });

  it("mantiene una tarifa definida si la configuración está vacía o no es válida", () => {
    for (const value of [undefined, null, "incorrecto", Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(shippingThreshold(value)).toBe(200);
      expect(shippingCostFor(100, value)).toBe(10);
    }
    expect(shippingCostFor(100, -1)).toBe(0);
  });
});
