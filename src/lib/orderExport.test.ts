import { describe, expect, it } from "vitest";
import { filterExportRows, parseExportFilters, type OrderExportRow } from "./orderExport";

const baseRow: OrderExportRow = {
  publicCode: "OD-0001",
  status: "PENDING_VALIDATION",
  createdAtIso: "2026-02-01T10:00:00.000Z",
  createdAtMs: Date.parse("2026-02-01T10:00:00.000Z"),
  deletedAtMs: null,
  customerName: "Andy",
  customerEmail: "andy@test.com",
  customerPhone: "999999999",
  paymentMethod: "YAPE",
  subtotal: 100,
  discount: 10,
  shippingCost: 10,
  total: 100,
  couponCode: "ODERA10",
  shippingType: "LIMA_DELIVERY",
  destination: "Lima",
};

describe("order export filters", () => {
  it("excludes trash by default", () => {
    const params = new URLSearchParams();
    const filters = parseExportFilters(params);
    const rows: OrderExportRow[] = [
      { ...baseRow, publicCode: "OD-0001", deletedAtMs: null },
      { ...baseRow, publicCode: "OD-0002", deletedAtMs: Date.now() },
    ];
    const out = filterExportRows(rows, filters);
    expect(out.map((x) => x.publicCode)).toEqual(["OD-0001"]);
  });

  it("includes trash when includeTrash=1", () => {
    const params = new URLSearchParams("includeTrash=1");
    const filters = parseExportFilters(params);
    const rows: OrderExportRow[] = [
      { ...baseRow, publicCode: "OD-0001", deletedAtMs: null },
      { ...baseRow, publicCode: "OD-0002", deletedAtMs: Date.now() },
    ];
    const out = filterExportRows(rows, filters);
    expect(out.map((x) => x.publicCode)).toEqual(["OD-0001", "OD-0002"]);
  });

  it("filters by status and date range", () => {
    const params = new URLSearchParams("status=PAID&from=2026-02-03&to=2026-02-05");
    const filters = parseExportFilters(params);
    const rows: OrderExportRow[] = [
      {
        ...baseRow,
        publicCode: "OD-0001",
        status: "PAID",
        createdAtMs: Date.parse("2026-02-03T01:00:00.000Z"),
      },
      {
        ...baseRow,
        publicCode: "OD-0002",
        status: "PAID",
        createdAtMs: Date.parse("2026-02-06T01:00:00.000Z"),
      },
      {
        ...baseRow,
        publicCode: "OD-0003",
        status: "CANCELLED",
        createdAtMs: Date.parse("2026-02-04T01:00:00.000Z"),
      },
    ];
    const out = filterExportRows(rows, filters);
    expect(out.map((x) => x.publicCode)).toEqual(["OD-0001"]);
  });
});

