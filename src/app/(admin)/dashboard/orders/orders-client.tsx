"use client";

import { useMemo, useState } from "react";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { formatPEN } from "@/lib/money";
import { ALLOWED_NEXT, isOrderStatus, type OrderStatus } from "@/lib/orderStatus";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/fields";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING_VALIDATION: "Pendiente de validación",
  PAYMENT_SENT: "Pago enviado",
  SCHEDULED: "Programado",
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  CANCELLED_EXPIRED: "Cancelado por vencimiento",
};

const STATUS_CONFIG: Record<string, { dot: string; badge: string; ring: string }> = {
  PENDING_VALIDATION: { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", ring: "ring-amber-200" },
  PAYMENT_SENT: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200", ring: "ring-blue-200" },
  SCHEDULED: { dot: "bg-slate-400", badge: "bg-slate-50 text-slate-600 border-slate-200", ring: "ring-slate-200" },
  PAID: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", ring: "ring-emerald-200" },
  SHIPPED: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200", ring: "ring-violet-200" },
  DELIVERED: { dot: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-800 border-emerald-300", ring: "ring-emerald-300" },
  CANCELLED: { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-200", ring: "ring-rose-200" },
  CANCELLED_EXPIRED: { dot: "bg-rose-400", badge: "bg-rose-50 text-rose-600 border-rose-200", ring: "ring-rose-200" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusOptions(currentStatus: string): string[] {
  if (!isOrderStatus(currentStatus)) return [currentStatus];
  const allowed = ALLOWED_NEXT[currentStatus];
  return [currentStatus, ...allowed.filter((s) => s !== currentStatus)];
}

function shippingLabel(shipping: any): string {
  if (!shipping) return "—";
  if (shipping.method === "LIMA_DELIVERY") return `Delivery · ${shipping.district}, ${shipping.addressLine1}`;
  return `Agencia ${shipping.agencyName} — ${shipping.department}/${shipping.province}`;
}

function urgencyLabel(order: OrderRow): string | null {
  if (order.status !== "PENDING_VALIDATION" && order.status !== "PAYMENT_SENT") return null;
  if (!order.reservedUntilMs) return "Sin TTL";
  const diffMin = Math.round((order.reservedUntilMs - Date.now()) / 60000);
  if (diffMin <= 0) return "⚠ Vencido";
  if (diffMin <= 15) return `⏱ Vence en ${diffMin} min`;
  return null;
}

function fmtCreatedAt(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { dot: "bg-slate-400", badge: "bg-slate-50 text-slate-600 border-slate-200", ring: "" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className="text-slate-400">{icon}</span>
      {label}
    </span>
  );
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  const isError = msg.toLowerCase().startsWith("error");
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-[var(--shadow-elevated)] fade-in ${isError
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
    >
      <span className="mt-0.5 shrink-0">
        {isError ? (
          <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        ) : (
          <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        )}
      </span>
      <span className="flex-1">{msg}</span>
      <button type="button" onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // ── Acciones ──────────────────────────────────────────────────────────────

  async function updateStatus(orderId: string, nextStatus: string) {
    setBusyId(orderId);
    setMsg(null);
    try {
      await apiPost("/api/admin/orders/update-status", { orderId, nextStatus }, { csrfCookieName: CSRF_COOKIE_NAME });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
      setStatusDraft((prev) => ({ ...prev, [orderId]: nextStatus }));
      setMsg("Estado actualizado correctamente.");
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Error desconocido"}`);
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
      setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`);
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
      setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`);
    } finally {
      setBusyDeleteId(null);
    }
  }

  async function purgeOrder(order: OrderRow) {
    if (!window.confirm(`Eliminar definitivamente pedido ${order.publicCode}?\nNo se puede deshacer.`)) return;
    setBusyDeleteId(order.id);
    setMsg(null);
    try {
      await apiPost("/api/admin/orders/purge", { orderId: order.id }, { csrfCookieName: CSRF_COOKIE_NAME });
      setOrders((prev) => prev.filter((x) => x.id !== order.id));
      setMsg(`Pedido ${order.publicCode} eliminado definitivamente.`);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`);
    } finally {
      setBusyDeleteId(null);
    }
  }

  async function bulkTrashByFilter() {
    if (!window.confirm("Mover masivamente a papelera según filtros de exportación?\nNo borra definitivamente.")) return;
    setBusyMass(true);
    setMsg(null);
    try {
      const olderThanDays = exportFrom ? Math.max(0, Math.floor((Date.now() - new Date(`${exportFrom}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24))) : 0;
      const res = await apiPost("/api/admin/orders/bulk-delete", { status: exportStatus, olderThanDays, limit: 500 }, { csrfCookieName: CSRF_COOKIE_NAME }) as { processed?: number };
      setMsg(`Pedidos enviados a papelera: ${res?.processed ?? 0}. Recarga para ver conteo exacto.`);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`);
    } finally {
      setBusyMass(false);
    }
  }

  async function bulkPurgeTrash() {
    if (!window.confirm("Eliminar definitivamente pedidos de papelera?\nNo se puede deshacer.")) return;
    setBusyMass(true);
    setMsg(null);
    try {
      const res = await apiPost("/api/admin/orders/bulk-purge", { olderThanDays: 0, limit: 500 }, { csrfCookieName: CSRF_COOKIE_NAME }) as { processed?: number };
      setMsg(`Pedidos eliminados definitivamente: ${res?.processed ?? 0}.`);
    } catch (e) {
      setMsg(`Error: ${e instanceof Error ? e.message : "Error"}`);
    } finally {
      setBusyMass(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900">Gestión de pedidos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Valida pagos, actualiza estados y gestiona el flujo de entrega.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("active")}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-150 ${viewMode === "active" ? "border-[var(--brand-400)] bg-[var(--brand-50)] text-[var(--brand-700)] shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-[var(--surface-hover)]"}`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Activos ({activeOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("trash")}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-150 ${viewMode === "trash" ? "border-rose-200 bg-rose-50 text-rose-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-[var(--surface-hover)]"}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Papelera ({trashedOrders.length})
          </button>
        </div>
      </div>

      {/* Notificación toast */}
      {msg && <Toast msg={msg} onClose={() => setMsg(null)} />}

      {/* Filtros y búsqueda */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Filtros de búsqueda</p>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_140px]">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Búsqueda rápida
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Código, nombre, correo o teléfono" className="pl-9" />
            </div>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Estado
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Todos los estados</option>
              {counts.map(([s, n]) => (
                <option key={s} value={s}>{STATUS_LABEL[s] ?? s}: {n}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-xs text-transparent">
            &nbsp;
            <Button type="button" variant="secondary" onClick={() => { setQuery(""); setStatusFilter("ALL"); }}>
              Limpiar filtros
            </Button>
          </label>
        </div>

        {/* Pills de estado rápido */}
        {counts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-slate-100">
            {counts.map(([s, n]) => {
              const cfg = STATUS_CONFIG[s] ?? { badge: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400", ring: "" };
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter((prev) => (prev === s ? "ALL" : s))}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-all duration-150 ${cfg.badge} ${active ? `ring-2 ${cfg.ring}` : ""}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  {STATUS_LABEL[s] ?? s}: {n}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Exportación */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-bold text-slate-900">Exportación de ventas</p>
            <p className="text-xs text-slate-500 mt-0.5">Compatible con Excel · Filtros por fecha y estado</p>
          </div>
          <svg className="h-5 w-5 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <div className="grid gap-3 md:grid-cols-[160px_160px_1fr_180px]">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Desde
            <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Hasta
            <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Estado
            <Select value={exportStatus} onChange={(e) => setExportStatus(e.target.value)}>
              <option value="ALL">Todos los estados</option>
              {counts.map(([s, n]) => (
                <option key={s} value={s}>{STATUS_LABEL[s] ?? s}: {n}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Plantilla
            <Select value={exportTemplate} onChange={(e) => setExportTemplate(e.target.value === "resumen" ? "resumen" : "detalle")}>
              <option value="detalle">Detalle completo</option>
              <option value="resumen">Resumen ejecutivo</option>
            </Select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand-700)] to-[var(--brand-500)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-brand)] hover:shadow-[0_10px_28px_rgba(31,77,31,0.35)] hover:-translate-y-0.5 transition-all duration-150"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Exportar CSV/Excel
          </a>
          <Button type="button" variant="secondary" onClick={() => { setExportFrom(""); setExportTo(""); setExportStatus("ALL"); setExportTemplate("detalle"); }}>
            Limpiar
          </Button>
          {viewMode === "active" ? (
            <Button type="button" variant="ghost" onClick={() => void bulkTrashByFilter()} disabled={busyMass}>
              {busyMass ? "Procesando..." : "Mover a papelera (masivo)"}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => void bulkPurgeTrash()} disabled={busyMass}>
              {busyMass ? "Procesando..." : "Vaciar papelera (definitivo)"}
            </Button>
          )}
        </div>
      </div>

      {/* Lista de pedidos */}
      <div className="grid gap-3">
        {visibleOrders.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <svg className="h-10 w-10 mx-auto text-slate-200 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            <p className="font-semibold text-slate-700">No hay pedidos con esos filtros.</p>
            <p className="text-sm text-slate-400 mt-1">Prueba limpiar filtros o cambiar entre Activos y Papelera.</p>
          </div>
        )}

        {visibleOrders.map((o) => {
          const urgency = urgencyLabel(o);
          const current = o.status;
          const draft = statusDraft[o.id] ?? current;
          const changed = draft !== current;
          const expanded = expandedId === o.id;
          const cfg = STATUS_CONFIG[current] ?? { dot: "bg-slate-400", badge: "bg-slate-50 text-slate-600 border-slate-200", ring: "" };

          return (
            <div
              key={o.id}
              className={`overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-elevated)] ${expanded ? `border-slate-300 ring-1 ${cfg.ring}` : "border-slate-200"}`}
            >
              {/* Zona 1: Encabezado clickeable */}
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpandedId((prev) => (prev === o.id ? null : o.id))}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{o.publicCode}</span>
                        <StatusPill status={current} />
                        {urgency && (
                          <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                            {urgency}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-3">
                        <InfoChip
                          label={o.customerName || o.email || "—"}
                          icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                        />
                        {o.phone && (
                          <InfoChip
                            label={o.phone}
                            icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
                          />
                        )}
                        <InfoChip
                          label={fmtCreatedAt(o.createdAtMs)}
                          icon={<svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-900 tabular-nums">{formatPEN(o.totalToPay)}</p>
                      <p className="text-xs text-slate-400">{o.paymentMethod || "—"}</p>
                    </div>
                    <span className={`text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </span>
                  </div>
                </div>
              </button>

              {/* Zona 2: Detalle expandido */}
              {expanded && (
                <div className="border-t border-slate-100 px-5 py-4 bg-[var(--surface-muted)] fade-in">
                  {/* Detalles de envío */}
                  <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Detalles de envío</p>
                    <p className="text-sm text-slate-700">{shippingLabel(o.shipping)}</p>
                  </div>

                  {/* Zona 3: Acciones */}
                  <div className="flex flex-wrap items-center gap-2">
                    {viewMode === "active" && (
                      <>
                        <Select
                          className="md:w-64"
                          value={draft}
                          onChange={(e) => setStatusDraft((prev) => ({ ...prev, [o.id]: e.target.value }))}
                        >
                          {getStatusOptions(current).map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s as OrderStatus] ?? s}</option>
                          ))}
                        </Select>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => updateStatus(o.id, draft)}
                          disabled={busyId === o.id || !changed}
                        >
                          {busyId === o.id ? "Guardando..." : "Confirmar estado"}
                        </Button>
                        {changed && <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">⚠ Cambio pendiente</span>}
                      </>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void navigator.clipboard.writeText(o.publicCode)}
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      Copiar código
                    </Button>

                    {o.receiptImageUrl ? (
                      <a
                        href={o.receiptImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--brand-200,#a7d7ac)] bg-[var(--brand-50)] px-4 py-2 text-sm font-semibold text-[var(--brand-700)] hover:bg-[var(--brand-100,#d8eedc)] transition-colors duration-150"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Ver comprobante
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Sin comprobante</span>
                    )}

                    {viewMode === "active" ? (
                      <Button type="button" variant="ghost" onClick={() => void deleteOrder(o)} disabled={busyDeleteId === o.id}>
                        {busyDeleteId === o.id ? "Procesando..." : "Enviar a papelera"}
                      </Button>
                    ) : (
                      <>
                        <Button type="button" variant="ghost" onClick={() => void restoreOrder(o)} disabled={busyDeleteId === o.id}>
                          {busyDeleteId === o.id ? "Procesando..." : "Restaurar"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => void purgeOrder(o)} disabled={busyDeleteId === o.id}>
                          {busyDeleteId === o.id ? "Procesando..." : "Eliminar definitivo"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
