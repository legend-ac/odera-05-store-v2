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
    ordersSnap = await adminDb.collection("orders").orderBy("createdAt", "desc").limit(8).get();
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Resumen</h1>
          <p className="text-sm text-slate-600">Vista rápida del estado operativo de la tienda.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/products" className="text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">
            Productos
          </Link>
          <Link href="/dashboard/orders" className="text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50">
            Pedidos
          </Link>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 text-sm font-semibold text-slate-900">Últimos pedidos</div>
        <div className="divide-y divide-slate-200">
          {orders.map((o) => (
            <div key={o.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="font-medium text-slate-900">{o.publicCode}</div>
                <div className="text-xs text-slate-600">{o.email ?? "-"}</div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs inline-flex px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                  {STATUS_LABEL[o.status] ?? o.status}
                </div>
                <div className="text-xs text-slate-600 mt-1">{o.createdAt}</div>
              </div>
            </div>
          ))}
          {!orders.length ? <div className="px-4 py-4 text-sm text-slate-600">Sin pedidos.</div> : null}
        </div>
      </div>

      <div className="panel p-3 text-xs text-slate-600">
        Recordatorio: el TTL se procesa por cron externo (GitHub Actions / cron-job.org). Vercel Hobby no soporta cron frecuente.
      </div>
    </div>
  );
}
