import { isOrderStatus } from "./orderStatus";

export type ExportTemplate = "detalle" | "resumen";

export type OrderExportRow = {
  publicCode: string;
  status: string;
  createdAtIso: string;
  createdAtMs: number | null;
  deletedAtMs: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: string;
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  couponCode: string;
  shippingType: string;
  destination: string;
};

export type ParsedExportFilters = {
  from: string;
  to: string;
  status: string;
  template: ExportTemplate;
  includeTrash: boolean;
  hasFrom: boolean;
  hasTo: boolean;
  fromMs: number;
  toMsFilter: number;
};

export function parseExportFilters(searchParams: URLSearchParams): ParsedExportFilters {
  const from = String(searchParams.get("from") ?? "").trim();
  const to = String(searchParams.get("to") ?? "").trim();
  const statusRaw = String(searchParams.get("status") ?? "").trim().toUpperCase();
  const status = isOrderStatus(statusRaw) ? statusRaw : "";
  const templateRaw = String(searchParams.get("template") ?? "detalle").trim().toLowerCase();
  const template: ExportTemplate = templateRaw === "resumen" ? "resumen" : "detalle";
  const includeTrash = String(searchParams.get("includeTrash") ?? "").trim() === "1";

  const fromMs = from ? Date.parse(`${from}T00:00:00.000Z`) : NaN;
  const toMsFilter = to ? Date.parse(`${to}T23:59:59.999Z`) : NaN;
  const hasFrom = Number.isFinite(fromMs);
  const hasTo = Number.isFinite(toMsFilter);

  return { from, to, status, template, includeTrash, hasFrom, hasTo, fromMs, toMsFilter };
}

export function filterExportRows(rows: OrderExportRow[], filters: ParsedExportFilters): OrderExportRow[] {
  return rows.filter((r) => {
    if (!filters.includeTrash && r.deletedAtMs) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.hasFrom && (r.createdAtMs === null || r.createdAtMs < filters.fromMs)) return false;
    if (filters.hasTo && (r.createdAtMs === null || r.createdAtMs > filters.toMsFilter)) return false;
    return true;
  });
}
