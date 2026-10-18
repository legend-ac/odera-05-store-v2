import { describe, expect, it } from "vitest";
import { inventoryErrorMessage, previewStockMovement } from "./adminInventory";

describe("previewStockMovement", () => {
  it("adds a positive quantity without exposing signed movements to the operator", () => {
    expect(previewStockMovement(7, "3", "ADD")).toEqual({ delta: 3, after: 10, error: null });
  });

  it("converts a withdrawal into the transaction delta and allows emptying a variant", () => {
    expect(previewStockMovement(7, "7", "REMOVE")).toEqual({ delta: -7, after: 0, error: null });
  });

  it.each(["", "0", "-2", "1.5", "2e2", "NaN", "100001"])("rejects an invalid movement quantity: %s", (quantity) => {
    expect(previewStockMovement(10, quantity, "ADD").error).toBeTruthy();
  });

  it("rejects withdrawals above available stock", () => {
    expect(previewStockMovement(2, "3", "REMOVE")).toMatchObject({ error: "Solo hay 2 unidades disponibles." });
  });

  it("does not suggest a movement based on invalid source stock", () => {
    expect(previewStockMovement(Number.NaN, "3", "ADD").error).toContain("Actualiza");
  });
});

describe("inventoryErrorMessage", () => {
  it("explains a concurrent sale instead of exposing a server code", () => {
    expect(inventoryErrorMessage("INSUFFICIENT_STOCK")).toContain("El stock cambió");
  });

  it("does not expose an unexpected internal error", () => {
    expect(inventoryErrorMessage("Firestore project private-id denied")).toBe("No pudimos completar la operación. Inténtalo de nuevo.");
  });
});
