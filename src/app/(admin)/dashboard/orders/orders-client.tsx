"use client";

import { useMemo, useState } from "react";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { formatPEN } from "@/lib/money";

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
};

const STATUS_OPTIONS = ["PENDING_VALIDATION", "PAYMENT_SENT", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

const STATUS_LABEL: Record<string, string> = {
  PENDING_VALIDATION: "Pendiente de validación de pago",
  PAYMENT_SENT: "Pendiente de validación de pago",
  SCHEDULED: "Pendiente de validación de pago",
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  CANCELLED_EXPIRED: "Cancelado por vencimiento",
};

function shippingLabel(shipping: any): string {
  if (!shipping) return "-";
  if (shipping.method === "LIMA_DELIVERY") {
    return `Delivery Lima: ${shipping.district} - ${shipping.addressLine1}`;
  }
  return `Agencia ${shipping.agencyName} - ${shipping.department}/${shipping.province}`;
}

export default function OrdersClient({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [orders]);

  async function updateStatus(orderId: string, nextStatus: string) {
    setBusyId(orderId);
    setMsg(null);
    try {
      await apiPost("/api/admin/orders/update-status", { orderId, nextStatus }, { csrfCookieName: CSRF_COOKIE_NAME });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
      setMsg("Estado actualizado.");
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setMsg(`Error: ${m}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Pedidos</h1>
          <p className="text-sm text-slate-600">Revisa datos completos, comprobante y estado del pedido.</p>
        </div>
        <div className="text-xs text-slate-600 flex flex-wrap gap-2">
          {counts.map(([s, n]) => (
            <span key={s} className="px-2 py-1 rounded-md bg-slate-100 border border-slate-200">
              {STATUS_LABEL[s] ?? s}: {n}
            </span>
          ))}
        </div>
      </div>

      {msg ? <div className="panel p-3 text-sm text-slate-700">{msg}</div> : null}

      <div className="grid gap-3">
        {orders.map((o) => (
          <div key={o.id} className="panel p-4 grid gap-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-900">{o.publicCode}</div>
                <div className="text-xs text-slate-600">{o.customerName} · {o.email} · {o.phone}</div>
              </div>
              <div className="text-xs px-2 py-1 rounded-md bg-slate-100 border border-slate-200 w-fit">
                {STATUS_LABEL[o.status] ?? o.status}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-slate-500">Total</div>
                <div className="font-semibold">{formatPEN(o.totalToPay)}</div>
              </div>
              <div>
                <div className="text-slate-500">Método</div>
                <div className="font-medium">{o.paymentMethod || "-"}</div>
              </div>
              <div>
                <div className="text-slate-500">Envío</div>
                <div className="font-medium">{shippingLabel(o.shipping)}</div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <select
                className="border border-slate-300 rounded-md px-2 py-2 text-sm"
                value={o.status}
                onChange={(e) => setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: e.target.value } : x)))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s] ?? s}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => updateStatus(o.id, o.status)}
                disabled={busyId === o.id}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                {busyId === o.id ? "Guardando..." : "Guardar estado"}
              </button>

              {o.receiptImageUrl ? (
                <a
                  href={o.receiptImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                >
                  Ver comprobante
                </a>
              ) : (
                <span className="text-xs text-slate-500">Sin comprobante</span>
              )}
            </div>
          </div>
        ))}
        {!orders.length ? <div className="panel p-4 text-sm text-slate-600">Sin pedidos</div> : null}
      </div>
    </div>
  );
}
