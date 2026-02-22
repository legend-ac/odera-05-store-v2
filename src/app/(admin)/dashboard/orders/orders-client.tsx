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
      setMsg("Estado actualizado correctamente.");
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
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Pedidos</h1>
          <p className="text-sm text-slate-600">Gestiona estado, comprobante y datos de entrega.</p>
        </div>
        <div className="text-xs text-slate-600 flex flex-wrap gap-2">
          {counts.map(([s, n]) => (
            <Badge key={s} tone={toneForStatus(s)}>
              {STATUS_LABEL[s] ?? s}: {n}
            </Badge>
          ))}
        </div>
      </div>

      {msg ? (
        <Card>
          <CardBody className="py-3 text-sm text-slate-700">{msg}</CardBody>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {orders.map((o) => (
          <Card key={o.id}>
            <CardBody className="grid gap-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{o.publicCode}</div>
                  <div className="text-xs text-slate-600">{o.customerName} - {o.email} - {o.phone}</div>
                </div>
                <Badge tone={toneForStatus(o.status)}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
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
                <Select
                  className="md:w-72"
                  value={o.status}
                  onChange={(e) => setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status: e.target.value } : x)))}
                >
                  {getStatusOptions(o.status).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s as OrderStatus] ?? s}
                    </option>
                  ))}
                </Select>

                <Button type="button" variant="secondary" onClick={() => updateStatus(o.id, o.status)} disabled={busyId === o.id}>
                  {busyId === o.id ? "Guardando..." : "Guardar estado"}
                </Button>

                {o.receiptImageUrl ? (
                  <a href={o.receiptImageUrl} target="_blank" rel="noreferrer" className="btn-soft">
                    Ver comprobante
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">Sin comprobante</span>
                )}
              </div>
            </CardBody>
          </Card>
        ))}
        {!orders.length ? (
          <Card>
            <CardBody className="text-sm text-slate-600">Sin pedidos</CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
