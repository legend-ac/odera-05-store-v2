import { describe, expect, it } from "vitest";
import { deriveStockDrivenStatus, getTotalStock, hasStock } from "./productStock";

describe("productStock", () => {
  it("suma stock total correctamente", () => {
    expect(getTotalStock([{ stock: 2 }, { stock: 0 }, { stock: 3 }])).toBe(5);
    expect(getTotalStock([])).toBe(0);
    expect(getTotalStock(undefined)).toBe(0);
  });

  it("detecta existencia de stock", () => {
    expect(hasStock([{ stock: 1 }])).toBe(true);
    expect(hasStock([{ stock: 0 }])).toBe(false);
  });

  it("auto archiva cuando total stock llega a 0", () => {
    const result = deriveStockDrivenStatus("active", [{ stock: 0 }], false);
    expect(result.status).toBe("archived");
    expect(result.autoArchivedByStock).toBe(true);
  });

  it("reactiva automaticamente si estaba auto archivado y vuelve stock", () => {
    const result = deriveStockDrivenStatus("archived", [{ stock: 4 }], true);
    expect(result.status).toBe("active");
    expect(result.autoArchivedByStock).toBe(false);
  });

  it("respeta archivado manual", () => {
    const result = deriveStockDrivenStatus("archived", [{ stock: 10 }], false);
    expect(result.status).toBe("archived");
    expect(result.autoArchivedByStock).toBe(false);
  });
});

