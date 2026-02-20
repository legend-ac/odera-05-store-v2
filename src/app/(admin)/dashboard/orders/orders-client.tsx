"use client";

import { useMemo, useState } from "react";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { formatPEN } from "@/lib/money";

type OrderRow = {
  id: string;
  publicCode: string;
  status: string;
  email: string;
  totalToPay: number;
  reservedUntilMs: number | null;
  createdAtMs: number | null;
};

const STATUS_OPTIONS = ["SCHEDULED", "PAYMENT_SENT", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Registrado",
  PAYMENT_SENT: "Pago enviado",
  PAID: "Pago confirmado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

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
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <div className="text-xs text-neutral-600 flex flex-wrap gap-2">
          {counts.map(([s, n]) => (
            <span key={s} className="px-2 py-1 rounded-md bg-slate-100">
              {STATUS_LABEL[s] ?? s}: {n}
            </span>
          ))}
        </div>
      </div>

      {msg ? <div className="text-sm text-neutral-700">{msg}</div> : null}

      <div className="overflow-auto border border-neutral-200 rounded-xl bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left p-3">Codigo</th>
              <th className="text-left p-3">Correo</th>
              <th className="text-left p-3">Total</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-left p-3">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="p-3 font-mono">{o.publicCode}</td>
                <td className="p-3">{o.email}</td>
                <td className="p-3">{formatPEN(o.totalToPay)}</td>
                <td className="p-3">
                  <select
                    className="border border-neutral-300 rounded-md px-2 py-1"
                    value={o.status}
                    onChange={(e) => setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: e.target.value } : x)))}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s] ?? s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => updateStatus(o.id, o.status)}
                    disabled={busyId === o.id}
                    className="px-3 py-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {busyId === o.id ? "Guardando..." : "Guardar"}
                  </button>
                </td>
              </tr>
            ))}
            {!orders.length ? <tr><td className="p-3" colSpan={5}>Sin pedidos</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-neutral-500">
        Si cancelas antes de Pago confirmado, el stock regresa automaticamente.
      </div>
    </div>
  );
}
