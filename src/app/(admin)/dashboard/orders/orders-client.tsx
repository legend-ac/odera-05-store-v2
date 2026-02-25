"use client";

import { useMemo, useState } from "react";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { formatPEN } from "@/lib/money";
import { ALLOWED_NEXT, isOrderStatus, type OrderStatus } from "@/lib/orderStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Select } from "@/components/ui/fields";

type OrderRow = {
  id: string;
  publicCode: string;
  status: string;
  customerName: string;
  email: string;
  phone: string;
  totalToPay: number;
  paymentMethod: string;
  receiptImageUrl: string;
  shipping: any;
  reservedUntilMs: number | null;
  createdAtMs: number | null;
  deletedAtMs?: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_VALIDATION: "Pendiente de validacion de pago",
  PAYMENT_SENT: "Pago enviado",
  SCHEDULED: "Programado",
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  CANCELLED_EXPIRED: "Cancelado por vencimiento",
};

function getStatusOptions(currentStatus: string): string[] {
  if (!isOrderStatus(currentStatus)) return [currentStatus];
  const allowed = ALLOWED_NEXT[currentStatus];
  return [currentStatus, ...allowed.filter((s) => s !== currentStatus)];
}

function shippingLabel(shipping: any): string {
  if (!shipping) return "-";
  if (shipping.method === "LIMA_DELIVERY") {
    return `Delivery Lima: ${shipping.district} - ${shipping.addressLine1}`;
  }
  return `Agencia ${shipping.agencyName} - ${shipping.department}/${shipping.province}`;
}

function toneForStatus(status: string): "default" | "sale" | "success" | "info" {
  if (status === "PAID" || status === "SHIPPED" || status === "DELIVERED") return "success";
  if (status === "PENDING_VALIDATION" || status === "PAYMENT_SENT" || status === "SCHEDULED") return "info";
  if (status === "CANCELLED" || status === "CANCELLED_EXPIRED") return "sale";
  return "default";
}

function urgencyLabel(order: OrderRow): string | null {
  if (order.status !== "PENDING_VALIDATION" && order.status !== "PAYMENT_SENT") return null;
  if (!order.reservedUntilMs) return "Sin TTL";
  const diffMin = Math.round((order.reservedUntilMs - Date.now()) / 60000);
  if (diffMin <= 0) return "Vencido";
  if (diffMin <= 15) return `Vence en ${diffMin} min`;
  return null;
}

export default function OrdersClient({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [statusDraft, setStatusDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportStatus, setExportStatus] = useState("ALL");
  const [exportTemplate, setExportTemplate] = useState<"detalle" | "resumen">("detalle");
  const [viewMode, setViewMode] = useState<"active" | "trash">("active");
  const [busyMass, setBusyMass] = useState(false);

  const activeOrders = useMemo(() => orders.filter((o) => !o.deletedAtMs), [orders]);
  const trashedOrders = useMemo(() => orders.filter((o) => !!o.deletedAtMs), [orders]);
  const baseList = viewMode === "active" ? activeOrders : trashedOrders;

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of baseList) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [baseList]);

  const visibleOrders = useMemo(() => {
    const token = query.trim().toLowerCase();
    return baseList.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (!token) return true;
      return [o.publicCode, o.customerName, o.email, o.phone].some((x) => (x ?? "").toLowerCase().includes(token));
    });
  }, [baseList, query, statusFilter]);

  const exportHref = useMemo(() => {
    const sp = new URLSearchParams();
    if (exportFrom) sp.set("from", exportFrom);
    if (exportTo) sp.set("to", exportTo);
    if (exportStatus !== "ALL") sp.set("status", exportStatus);
    sp.set("template", exportTemplate);
    return `/api/admin/orders/export?${sp.toString()}`;
  }, [exportFrom, exportTo, exportStatus, exportTemplate]);

  async function updateStatus(orderId: string, nextStatus: string) {
    setBusyId(orderId);
    setMsg(null);
    try {
      await apiPost("/api/admin/orders/update-status", { orderId, nextStatus }, { csrfCookieName: CSRF_COOKIE_NAME });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
      setStatusDraft((prev) => ({ ...prev, [orderId]: nextStatus }));
      setMsg("Estado actualizado correctamente.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(`Error: ${m}`);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOrder(order: OrderRow) {
    if (!window.confirm(`Mover pedido ${order.publicCode} a papelera?\nSolo se permite en estados terminales (Cancelado o Entregado).`)) return;
    setBusyDeleteId(order.id);
    setMsg(null);
    try {
      await apiPost("/api/admin/orders/delete", { orderId: order.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      setOrders((prev) => prev.map((x) => (x.id === order.id ? { ...x, deletedAtMs: Date.now() } : x)));
      setMsg(`Pedido ${order.publicCode} enviado a papelera.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(`Error: ${m}`);
    } finally {
      setBusyDeleteId(null);
    }
  }

  async function restoreOrder(order: OrderRow) {
    if (!window.confirm(`Restaurar pedido ${order.publicCode} desde papelera?`)) return;
    setBusyDeleteId(order.id);
    setMsg(null);
    try {
      await apiPost("/api/admin/orders/restore", { orderId: order.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      setOrders((prev) => prev.map((x) => (x.id === order.id ? { ...x, deletedAtMs: null } : x)));
      setMsg(`Pedido ${order.publicCode} restaurado.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(`Error: ${m}`);
    } finally {
      setBusyDeleteId(null);
    }
  }

  async function bulkTrashByFilter() {
    if (!window.confirm("Mover masivamente a papelera segun filtros de exportacion?\nNo borra definitivamente.")) return;
    setBusyMass(true);
    setMsg(null);
    try {
      const olderThanDays = exportFrom
        ? Math.max(0, Math.floor((Date.now() - new Date(`${exportFrom}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24)))
        : 0;
      const payload = {
        status: exportStatus,
        olderThanDays,
        limit: 500,
      };
      const res = await apiPost("/api/admin/orders/bulk-delete", payload, { csrfCookieName: CSRF_COOKIE_NAME }) as { processed?: number };
      setMsg(`Pedidos enviados a papelera: ${res?.processed ?? 0}. Recarga la pagina para ver conteo exacto.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(`Error: ${m}`);
    } finally {
      setBusyMass(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900">Pedidos</h1>
          <p className="text-sm text-slate-600">Gestiona estado, comprobante y datos de entrega.</p>
        </div>
        <div className="text-xs text-slate-600 flex flex-wrap gap-2 items-center">
          <Button type="button" variant={viewMode === "active" ? "secondary" : "ghost"} onClick={() => setViewMode("active")}>
            Activos ({activeOrders.length})
          </Button>
          <Button type="button" variant={viewMode === "trash" ? "secondary" : "ghost"} onClick={() => setViewMode("trash")}>
            Papelera ({trashedOrders.length})
          </Button>
          <Badge tone="default">Mostrando: {baseList.length}</Badge>
          {counts.map(([s, n]) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === s ? "ALL" : s))}
              className={statusFilter === s ? "ring-2 ring-slate-400 rounded-full" : ""}
            >
              <Badge tone={toneForStatus(s)}>
                {STATUS_LABEL[s] ?? s}: {n}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      <Card className="rounded-2xl border-slate-200">
        <CardBody className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por codigo, nombre, correo o telefono"
            className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
          />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl min-w-[220px]">
            <option value="ALL">Todos los estados</option>
            {counts.map(([s, n]) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] ?? s}: {n}
              </option>
            ))}
          </Select>
          <Button type="button" variant="secondary" onClick={() => { setQuery(""); setStatusFilter("ALL"); }}>
            Limpiar
          </Button>
        </CardBody>
      </Card>

      <Card className="rounded-2xl border-slate-200">
        <CardBody className="grid gap-3 md:grid-cols-[180px_180px_1fr_180px_auto_auto] md:items-end">
          <label className="grid gap-1 text-xs text-slate-600">
            Desde
            <input
              type="date"
              value={exportFrom}
              onChange={(e) => setExportFrom(e.target.value)}
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>

          <label className="grid gap-1 text-xs text-slate-600">
            Hasta
            <input
              type="date"
              value={exportTo}
              onChange={(e) => setExportTo(e.target.value)}
              className="h-10 rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>

          <label className="grid gap-1 text-xs text-slate-600">
            Estado
            <Select
              value={exportStatus}
              onChange={(e) => setExportStatus(e.target.value)}
              className="rounded-xl min-w-[220px]"
            >
              <option value="ALL">Todos los estados</option>
              {counts.map(([s, n]) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s] ?? s}: {n}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-1 text-xs text-slate-600">
            Plantilla
            <Select
              value={exportTemplate}
              onChange={(e) => setExportTemplate(e.target.value === "resumen" ? "resumen" : "detalle")}
              className="rounded-xl"
            >
              <option value="detalle">Detalle</option>
              <option value="resumen">Resumen ejecutivo</option>
            </Select>
          </label>

          <a href={exportHref} className="btn-soft">
            Exportar CSV
          </a>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setExportFrom("");
              setExportTo("");
              setExportStatus("ALL");
              setExportTemplate("detalle");
            }}
          >
            Limpiar export
          </Button>
          {viewMode === "active" ? (
            <Button type="button" variant="ghost" onClick={() => void bulkTrashByFilter()} disabled={busyMass}>
              {busyMass ? "Procesando..." : "Mover a papelera (masivo)"}
            </Button>
          ) : null}
        </CardBody>
      </Card>

      {msg ? (
        <Card className="rounded-2xl border-slate-200">
          <CardBody className="py-3 text-sm text-slate-700">{msg}</CardBody>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {visibleOrders.map((o) => (
          <Card key={o.id} className="rounded-2xl border-slate-200 panel-soft-hover">
            <CardBody className="grid gap-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{o.publicCode}</div>
                  <div className="text-xs text-slate-600">{o.customerName} - {o.email} - {o.phone}</div>
                </div>
                <div className="flex items-center gap-2">
                  {urgencyLabel(o) ? <Badge tone="sale">{urgencyLabel(o)}</Badge> : null}
                  <Badge tone={toneForStatus(o.status)}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-slate-500">Total</div>
                  <div className="font-semibold">{formatPEN(o.totalToPay)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Metodo</div>
                  <div className="font-medium">{o.paymentMethod || "-"}</div>
                </div>
                <div>
                  <div className="text-slate-500">Envio</div>
                  <div className="font-medium">{shippingLabel(o.shipping)}</div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                {(() => {
                  const current = o.status;
                  const draft = statusDraft[o.id] ?? current;
                  const changed = draft !== current;
                  return (
                      <>
                        {viewMode === "active" ? (
                          <>
                            <Select
                              className="md:w-72 rounded-xl"
                              value={draft}
                              onChange={(e) => setStatusDraft((prev) => ({ ...prev, [o.id]: e.target.value }))}
                            >
                              {getStatusOptions(current).map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABEL[s as OrderStatus] ?? s}
                                </option>
                              ))}
                            </Select>

                            <Button type="button" variant="secondary" onClick={() => updateStatus(o.id, draft)} disabled={busyId === o.id || !changed}>
                              {busyId === o.id ? "Guardando..." : "Guardar estado"}
                            </Button>
                          </>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => navigator.clipboard.writeText(o.publicCode)}
                          className="md:w-auto"
                        >
                          Copiar codigo
                        </Button>
                        {viewMode === "active" && changed ? <span className="text-xs text-amber-700">Cambio pendiente por guardar</span> : null}
                      </>
                    );
                })()}

                {o.receiptImageUrl ? (
                  <a href={o.receiptImageUrl} target="_blank" rel="noreferrer" className="btn-soft rounded-xl">
                    Ver comprobante
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">Sin comprobante</span>
                )}
                {viewMode === "active" ? (
                  <Button type="button" variant="ghost" onClick={() => void deleteOrder(o)} disabled={busyDeleteId === o.id}>
                    {busyDeleteId === o.id ? "Procesando..." : "Enviar a papelera"}
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => void restoreOrder(o)} disabled={busyDeleteId === o.id}>
                    {busyDeleteId === o.id ? "Procesando..." : "Restaurar"}
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
        {!visibleOrders.length ? (
          <Card className="rounded-2xl border-slate-200">
            <CardBody className="text-sm text-slate-600">Sin pedidos para ese filtro.</CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
