export const runtime = "nodejs";
export const maxDuration = 60;

import Link from "next/link";
import { adminDb } from "@/lib/server/firebaseAdmin";

function fmt(ts: any): string {
  try {
    if (ts?.toDate) return ts.toDate().toLocaleString("es-PE");
  } catch { }
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
  PENDING_VALIDATION: "Pendiente de validación",
  SCHEDULED: "Registrado",
  PAYMENT_SENT: "Pago enviado",
  PAID: "Pago confirmado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

const STATUS_STYLE: Record<string, { dot: string; badge: string }> = {
  PENDING_VALIDATION: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  PAYMENT_SENT: { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  SCHEDULED: { dot: "bg-slate-400", badge: "bg-slate-50 text-slate-700 border-slate-200" },
  PAID: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  SHIPPED: { dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 border-violet-200" },
  DELIVERED: { dot: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  CANCELLED: { dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  CANCELLED_EXPIRED: { dot: "bg-rose-400", badge: "bg-rose-50 text-rose-600 border-rose-200" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { dot: "bg-slate-400", badge: "bg-slate-50 text-slate-700 border-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function KPICard({
  label,
  value,
  sub,
  accent,
  icon,
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-elevated)] hover:-translate-y-0.5`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${accent}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-1.5 text-3xl font-black text-slate-900 tabular-nums">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${accent.replace("bg-", "bg-").replace("-500", "-50").replace("-600", "-50").replace("-400", "-50")} text-current`}>
          {icon}
        </div>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function DashboardHome() {
  let ordersSnap: any = null;
  let productsSnap: any = null;

  try {
    ordersSnap = await adminDb.collection("orders").orderBy("createdAt", "desc").limit(120).get();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("NOT_FOUND")) throw e;
  }

  try {
    productsSnap = await adminDb.collection("products").where("deletedAtMs", "==", null).get();
  } catch { }

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

  const activeOrders = orders.filter((o) => !("deletedAtMs" in o));
  const pendingCount = orders.filter((o) => o.status === "PENDING_VALIDATION" || o.status === "PAYMENT_SENT").length;
  const paidCount = orders.filter((o) => o.status === "PAID" || o.status === "SHIPPED" || o.status === "DELIVERED").length;
  const cancelledCount = orders.filter((o) => o.status === "CANCELLED" || o.status === "CANCELLED_EXPIRED").length;
  const grossRecent = orders.reduce((acc, o) => acc + Number(o.total ?? 0), 0);
  const readyToShip = orders.filter((o) => o.status === "PAID").length;
  const totalProductsActive = productsSnap?.size ?? 0;
  const renderOrders = orders.slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900">Resumen operativo</h1>
          <p className="text-sm text-slate-500 mt-0.5">Vista rápida del estado actual de tu tienda ODERA 05.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-[var(--surface-hover)] hover:border-slate-300 transition-all duration-150"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Productos
          </Link>
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-[var(--surface-hover)] hover:border-slate-300 transition-all duration-150"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Pedidos
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KPICard
          label="Requieren atención"
          value={pendingCount}
          sub="Pendientes de validar pago"
          accent="bg-amber-500"
          href="/dashboard/orders"
          icon={
            <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KPICard
          label="Pagados / Enviados"
          value={paidCount}
          sub="Confirmados o en camino"
          accent="bg-emerald-500"
          href="/dashboard/orders"
          icon={
            <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <KPICard
          label="Listos para despachar"
          value={readyToShip}
          sub="Pago confirmado, sin enviar"
          accent="bg-violet-500"
          href="/dashboard/orders"
          icon={
            <svg className="h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2L19 8" />
            </svg>
          }
        />
        <KPICard
          label="Ingresos recientes"
          value={`S/ ${grossRecent.toFixed(2)}`}
          sub={`${orders.length} pedidos totales cargados`}
          accent="bg-brand-600"
          icon={
            <svg className="h-5 w-5 text-[var(--brand-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Acciones rápidas */}
      <div className="rounded-2xl border border-slate-200 bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Acciones rápidas</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand-700)] to-[var(--brand-500)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-brand)] hover:shadow-[0_10px_28px_rgba(31,77,31,0.35)] hover:-translate-y-0.5 transition-all duration-150"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo producto
          </Link>
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors duration-150"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Ver pendientes ({pendingCount})
          </Link>
          <Link
            href="/dashboard/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-hover)] transition-colors duration-150"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar ventas
          </Link>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-[var(--surface-hover)] transition-colors duration-150"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configuración
          </Link>
        </div>
      </div>

      {/* Estado de la tienda */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Cancelados</p>
          <p className="text-2xl font-black text-rose-600 tabular-nums">{cancelledCount}</p>
          <p className="text-xs text-slate-500 mt-1">Cancelados o vencidos</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Productos activos</p>
          <p className="text-2xl font-black text-[var(--brand-700)] tabular-nums">{totalProductsActive}</p>
          <p className="text-xs text-slate-500 mt-1">En catálogo público</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Total pedidos</p>
          <p className="text-2xl font-black text-slate-900 tabular-nums">{orders.length}</p>
          <p className="text-xs text-slate-500 mt-1">Últimos 120 cargados</p>
        </div>
      </div>

      {/* Últimos pedidos */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-900">Últimos pedidos</p>
            <p className="text-xs text-slate-500 mt-0.5">Los 8 más recientes del sistema</p>
          </div>
          <Link
            href="/dashboard/orders"
            className="text-xs font-semibold text-[var(--brand-600)] hover:underline"
          >
            Ver todos →
          </Link>
        </div>
        {!orders.length ? (
          <div className="px-5 py-8 text-sm text-slate-500 text-center">
            <svg className="h-10 w-10 mx-auto text-slate-200 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            No hay pedidos aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pedido</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {renderOrders.map((o, i) => (
                  <tr key={o.id} className={`hover:bg-[var(--surface-muted)] transition-colors duration-100 ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">{o.publicCode}</span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 text-xs">{o.email ?? "-"}</td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                      S/ {Number(o.total ?? 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{o.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Nota técnica */}
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <svg className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>El TTL de reservas se procesa por cron externo (GitHub Actions / cron-job.org). Vercel Hobby no soporta cron frecuente. Los datos de ingresos son estimados sobre los últimos 120 pedidos cargados.</p>
      </div>
    </div>
  );
}
