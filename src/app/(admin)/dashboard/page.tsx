export const runtime = "nodejs";
export const maxDuration = 60;

import Link from "next/link";
import { adminDb } from "@/lib/server/firebaseAdmin";

function fmt(ts: any): string {
  try {
    if (ts?.toDate) return ts.toDate().toLocaleString("es-PE");
  } catch {}
  return "";
}

type DashboardOrder = {
  id: string;
  publicCode: string;
  status: string;
  email?: string;
  total?: number;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_VALIDATION: "Pendiente de validacion de pago",
  SCHEDULED: "Registrado",
  PAYMENT_SENT: "Pago enviado",
  PAID: "Pago confirmado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export default async function DashboardHome() {
  let ordersSnap: any = null;
  try {
    ordersSnap = await adminDb.collection("orders").orderBy("createdAt", "desc").limit(120).get();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("NOT_FOUND")) throw e;
  }

  const orders: DashboardOrder[] = (ordersSnap?.docs ?? []).map((d: any) => {
    const data = d.data() as any;
    return {
      id: d.id,
      publicCode: data.publicCode as string,
      status: data.status as string,
      email: data.customer?.email as string | undefined,
      total: data.totals?.totalToPay as number | undefined,
      createdAt: fmt(data.createdAt),
    };
  });
  const pendingCount = orders.filter((o) => o.status === "PENDING_VALIDATION" || o.status === "PAYMENT_SENT").length;
  const paidCount = orders.filter((o) => o.status === "PAID" || o.status === "SHIPPED" || o.status === "DELIVERED").length;
  const cancelledCount = orders.filter((o) => o.status === "CANCELLED" || o.status === "CANCELLED_EXPIRED").length;
  const grossRecent = orders.reduce((acc, o) => acc + Number(o.total ?? 0), 0);
  const readyToShip = orders.filter((o) => o.status === "PAID").length;
  const renderOrders = orders.slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900">Resumen operativo</h1>
          <p className="text-sm text-slate-600">Vista rapida del estado actual de la tienda.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/products" className="text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-medium">
            Productos
          </Link>
          <Link href="/dashboard/orders" className="text-sm px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-medium">
            Pedidos
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-2 text-xs">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-900">Pendientes de validar: {pendingCount}</div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">Pagados / enviados: {paidCount}</div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900">Cancelados: {cancelledCount}</div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-violet-900">Listos para enviar: {readyToShip}</div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900">Ventas recientes: S/ {grossRecent.toFixed(2)}</div>
      </div>

      <div className="panel overflow-hidden rounded-2xl border-slate-200">
        <div className="px-4 py-3 bg-slate-50 text-sm font-semibold text-slate-900 border-b border-slate-200">Ultimos pedidos</div>
        {!orders.length ? (
          <div className="px-4 py-4 text-sm text-slate-600">Sin pedidos.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold border-b border-slate-200">Pedido</th>
                  <th className="text-left px-4 py-3 font-semibold border-b border-slate-200">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold border-b border-slate-200">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold border-b border-slate-200">Total</th>
                  <th className="text-left px-4 py-3 font-semibold border-b border-slate-200">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {renderOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-900">{o.publicCode}</td>
                    <td className="px-4 py-3 border-b border-slate-100 text-slate-700">{o.email ?? "-"}</td>
                    <td className="px-4 py-3 border-b border-slate-100 text-slate-700">{STATUS_LABEL[o.status] ?? o.status}</td>
                    <td className="px-4 py-3 border-b border-slate-100 text-slate-900">S/ {Number(o.total ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-3 border-b border-slate-100 text-slate-600">{o.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel p-3 text-xs text-slate-600 rounded-2xl border-slate-200 bg-slate-50/70">
        Recordatorio: el TTL se procesa por cron externo (GitHub Actions / cron-job.org). Vercel Hobby no soporta cron frecuente.
      </div>
    </div>
  );
}
