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

function toMs(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return null;
}

function totalStock(product: DashboardProduct): number {
  return product.variants.reduce((acc, v) => acc + Number(v?.stock ?? 0), 0);
}

function money(value: number): string {
  return `S/ ${Number(value || 0).toFixed(2)}`;
}

type DashboardOrder = {
  id: string;
  publicCode: string;
  status: string;
  email?: string;
  total: number;
  createdAt: string;
  createdAtMs: number | null;
  deletedAtMs: number | null;
};

type DashboardProduct = {
  id: string;
  name: string;
  slug: string;
  status: string;
  price: number;
  images: any[];
  variants: { stock?: number }[];
  deletedAtMs: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_VALIDATION: "Pendiente",
  SCHEDULED: "Registrado",
  PAYMENT_SENT: "Pago enviado",
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  CANCELLED_EXPIRED: "Vencido",
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
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent: string;
  href?: string;
}) {
  const inner = (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-elevated)]">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} />
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function WorkItem({
  tone,
  title,
  detail,
  href,
}: {
  tone: "red" | "amber" | "green" | "blue";
  title: string;
  detail: string;
  href: string;
}) {
  const style = {
    red: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
  }[tone];
  return (
    <Link href={href} className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 transition hover:brightness-[0.98] ${style}`}>
      <span>
        <span className="block text-sm font-black text-slate-950">{title}</span>
        <span className="mt-0.5 block text-xs font-medium opacity-80">{detail}</span>
      </span>
      <span className="text-lg font-black leading-none">→</span>
    </Link>
  );
}

export default async function DashboardHome() {
  let ordersSnap: any = null;
  let productsSnap: any = null;

  try {
    [ordersSnap, productsSnap] = await Promise.all([
      adminDb.collection("orders").orderBy("createdAt", "desc").limit(80).get(),
      adminDb.collection("products").orderBy("updatedAt", "desc").limit(500).get().catch(() => null),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("NOT_FOUND")) throw e;
  }

  const orders: DashboardOrder[] = (ordersSnap?.docs ?? []).map((d: any) => {
    const data = d.data() as any;
    return {
      id: d.id,
      publicCode: String(data.publicCode ?? d.id),
      status: String(data.status ?? ""),
      email: data.customer?.email as string | undefined,
      total: Number(data.totals?.totalToPay ?? 0),
      createdAt: fmt(data.createdAt),
      createdAtMs: toMs(data.createdAt),
      deletedAtMs: toMs(data.deletedAt),
    };
  });

  const products: DashboardProduct[] = (productsSnap?.docs ?? []).map((d: any) => {
    const data = d.data() as any;
    return {
      id: d.id,
      name: String(data.name ?? ""),
      slug: String(data.slug ?? d.id),
      status: String(data.status ?? "active"),
      price: Number(data.price ?? 0),
      images: Array.isArray(data.images) ? data.images : [],
      variants: Array.isArray(data.variants) ? data.variants : [],
      deletedAtMs: toMs(data.deletedAt),
    };
  });

  const activeOrders = orders.filter((o) => !o.deletedAtMs);
  const activeProducts = products.filter((p) => !p.deletedAtMs);
  const publicProducts = activeProducts.filter((p) => p.status === "active");
  const archivedProducts = activeProducts.filter((p) => p.status === "archived");

  const paymentQueue = activeOrders.filter((o) => o.status === "PENDING_VALIDATION" || o.status === "PAYMENT_SENT");
  const readyToShip = activeOrders.filter((o) => o.status === "PAID");
  const shipped = activeOrders.filter((o) => o.status === "SHIPPED");
  const delivered = activeOrders.filter((o) => o.status === "DELIVERED");
  const cancelled = activeOrders.filter((o) => o.status === "CANCELLED" || o.status === "CANCELLED_EXPIRED");

  const confirmedRevenue = activeOrders
    .filter((o) => ["PAID", "SHIPPED", "DELIVERED"].includes(o.status))
    .reduce((acc, o) => acc + o.total, 0);
  const pendingRevenue = paymentQueue.reduce((acc, o) => acc + o.total, 0);
  const deliveredRevenue = delivered.reduce((acc, o) => acc + o.total, 0);
  const todayKey = new Date().toLocaleDateString("es-PE");
  const todayOrders = activeOrders.filter((o) => (o.createdAtMs ? new Date(o.createdAtMs).toLocaleDateString("es-PE") === todayKey : false));
  const todayRevenue = todayOrders
    .filter((o) => ["PAID", "SHIPPED", "DELIVERED"].includes(o.status))
    .reduce((acc, o) => acc + o.total, 0);

  const lowStockProducts = publicProducts.filter((p) => {
    const stock = totalStock(p);
    return stock > 0 && stock <= 3;
  });
  const outOfStockProducts = activeProducts.filter((p) => totalStock(p) <= 0);
  const noImageProducts = activeProducts.filter((p) => p.images.length === 0);
  const incompleteProducts = activeProducts.filter((p) => !p.name || p.price <= 0 || p.variants.length === 0 || p.images.length === 0);

  const smtpReady = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  const cloudinaryReady = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
  const appCheckReady = process.env.ENABLE_APP_CHECK_VERIFY === "true" || process.env.ENABLE_APP_CHECK_VERIFY === "1";

  const renderOrders = activeOrders.slice(0, 8);
  const urgentOrders = [...paymentQueue, ...readyToShip].slice(0, 5);
  const productIssues = [...noImageProducts, ...outOfStockProducts, ...incompleteProducts]
    .filter((p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900 md:text-2xl">Centro operativo</h1>
          <p className="mt-0.5 text-sm text-slate-500">Prioridades, ventas, catálogo y salud de la tienda.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/products" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-[var(--surface-hover)]">
            Productos
          </Link>
          <Link href="/dashboard/inventory" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-[var(--surface-hover)]">
            Inventario
          </Link>
          <Link href="/dashboard/orders" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-[var(--surface-hover)]">
            Pedidos
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard label="Atención ahora" value={paymentQueue.length} sub="Pagos por validar" accent="bg-amber-500" href="/dashboard/orders" />
        <KPICard label="Por despachar" value={readyToShip.length} sub="Pagados sin envío" accent="bg-violet-500" href="/dashboard/orders" />
        <KPICard label="Venta confirmada" value={money(confirmedRevenue)} sub={`${delivered.length + shipped.length + readyToShip.length} pedidos confirmados`} accent="bg-emerald-500" />
        <KPICard label="Ventas de hoy" value={money(todayRevenue)} sub={`${todayOrders.length} pedidos creados hoy`} accent="bg-blue-500" href="/dashboard/orders" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Acciones rapidas</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/dashboard/products" className="rounded-xl bg-[var(--brand-700)] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[var(--brand-800)]">Nuevo producto</Link>
          <Link href="/dashboard/orders" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-800 hover:bg-amber-100">Validar pagos ({paymentQueue.length})</Link>
          <Link href="/dashboard/inventory?state=LOW" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-700 hover:bg-rose-100">Gestionar stock ({lowStockProducts.length + outOfStockProducts.length})</Link>
          <Link href="/dashboard/orders" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-black text-blue-700 hover:bg-blue-100">Exportar hoy / semana</Link>
          <Link href="/dashboard/products" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Papelera</Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Cola de trabajo</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Qué atender primero</h2>
            </div>
            <Link href="/dashboard/orders" className="text-xs font-bold text-[var(--brand-700)] hover:underline">Abrir pedidos</Link>
          </div>
          <div className="grid gap-2">
            {paymentQueue.length > 0 && (
              <WorkItem tone="amber" title={`Validar ${paymentQueue.length} pago(s)`} detail={`${money(pendingRevenue)} pendiente de confirmación`} href="/dashboard/orders" />
            )}
            {readyToShip.length > 0 && (
              <WorkItem tone="blue" title={`Despachar ${readyToShip.length} pedido(s)`} detail="Ya pagaron y esperan envío" href="/dashboard/orders" />
            )}
            {outOfStockProducts.length > 0 && (
              <WorkItem tone="red" title={`${outOfStockProducts.length} producto(s) sin stock`} detail="Reponer o mantener archivados" href="/dashboard/products" />
            )}
            {noImageProducts.length > 0 && (
              <WorkItem tone="amber" title={`${noImageProducts.length} producto(s) sin imagen`} detail="Corrige tarjetas débiles del catálogo" href="/dashboard/products" />
            )}
            {paymentQueue.length === 0 && readyToShip.length === 0 && outOfStockProducts.length === 0 && noImageProducts.length === 0 && (
              <WorkItem tone="green" title="Operación sin urgencias críticas" detail="No hay pagos, despachos ni catálogo roto pendientes" href="/dashboard" />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Salud del sistema</p>
          <div className="mt-4 grid gap-2">
            {[
              { label: "Correo SMTP", ok: smtpReady, detail: smtpReady ? "Configurado" : "Falta usuario o clave" },
              { label: "Cloudinary", ok: cloudinaryReady, detail: cloudinaryReady ? "Subida de imágenes lista" : "Falta cloud/preset" },
              { label: "App Check", ok: appCheckReady, detail: appCheckReady ? "Verificación activa" : "No obligatorio en local" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${item.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  {item.ok ? "OK" : "Revisar"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard label="Bajo stock" value={lowStockProducts.length} sub="Activos con 1 a 3 unidades" accent="bg-amber-500" href="/dashboard/products" />
        <KPICard label="Sin stock" value={outOfStockProducts.length} sub="Reponer o archivar" accent="bg-rose-500" href="/dashboard/products" />
        <KPICard label="Incompletos" value={incompleteProducts.length} sub="Sin imagen, precio o variantes" accent="bg-blue-500" href="/dashboard/products" />
        <KPICard label="Cancelados" value={cancelled.length} sub="Cancelados o vencidos" accent="bg-slate-500" href="/dashboard/orders" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Pedidos prioritarios</p>
              <p className="mt-0.5 text-xs text-slate-500">Pagos por validar y despachos pendientes</p>
            </div>
            <Link href="/dashboard/orders" className="text-xs font-semibold text-[var(--brand-600)] hover:underline">Ver todos →</Link>
          </div>
          {!urgentOrders.length ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">No hay pedidos urgentes.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {urgentOrders.map((o) => (
                <div key={o.id} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 px-5 py-3">
                  <span className="font-mono text-xs font-bold text-slate-800">{o.publicCode}</span>
                  <StatusPill status={o.status} />
                  <span className="text-sm font-black text-slate-950">{money(o.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Catálogo por corregir</p>
              <p className="mt-0.5 text-xs text-slate-500">Productos que bajan calidad o conversión</p>
            </div>
            <Link href="/dashboard/products" className="text-xs font-semibold text-[var(--brand-600)] hover:underline">Abrir productos →</Link>
          </div>
          {!productIssues.length ? (
            <div className="px-5 py-8 text-center text-sm text-slate-500">No hay problemas visibles en catálogo.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {productIssues.map((p) => (
                <div key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{p.name || p.slug}</p>
                    <p className="text-xs text-slate-500">
                      {p.images.length === 0 ? "Sin imagen" : totalStock(p) <= 0 ? "Sin stock" : "Datos incompletos"}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    stock {totalStock(p)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Pendiente de cobro</p>
          <p className="mt-2 text-2xl font-black text-amber-600 tabular-nums">{money(pendingRevenue)}</p>
          <p className="mt-1 text-xs text-slate-500">No contar como venta confirmada</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Entregado</p>
          <p className="mt-2 text-2xl font-black text-emerald-700 tabular-nums">{money(deliveredRevenue)}</p>
          <p className="mt-1 text-xs text-slate-500">{delivered.length} pedidos finalizados</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Pedidos cargados</p>
          <p className="mt-2 text-2xl font-black text-slate-900 tabular-nums">{activeOrders.length}</p>
          <p className="mt-1 text-xs text-slate-500">Últimos 80 activos</p>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-bold text-slate-900">Últimos pedidos</p>
            <p className="mt-0.5 text-xs text-slate-500">Los 8 activos más recientes del sistema</p>
          </div>
          <Link href="/dashboard/orders" className="text-xs font-semibold text-[var(--brand-600)] hover:underline">Ver todos →</Link>
        </div>
        {!renderOrders.length ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">No hay pedidos aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pedido</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Cliente</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {renderOrders.map((o, i) => (
                  <tr key={o.id} className={`transition-colors duration-100 hover:bg-[var(--surface-muted)] ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                    <td className="px-5 py-3.5">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-800">{o.publicCode}</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">{o.email ?? "-"}</td>
                    <td className="px-5 py-3.5"><StatusPill status={o.status} /></td>
                    <td className="px-5 py-3.5 text-right font-bold tabular-nums text-slate-900">{money(o.total)}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">{o.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>El TTL de reservas se procesa por cron externo. Las métricas se calculan sobre los últimos 80 pedidos y hasta 500 productos recientes.</p>
      </div>
    </div>
  );
}
