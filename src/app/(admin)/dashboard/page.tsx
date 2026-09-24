export const runtime = "nodejs";
export const maxDuration = 60;

import Link from "next/link";
import { adminDb } from "@/lib/server/firebaseAdmin";

type Order = { id: string; publicCode: string; status: string; email?: string; total: number; createdAt: string; deletedAt: boolean };
type Product = { id: string; name: string; slug: string; status: string; images: unknown[]; variants: { stock?: number }[]; deletedAt: boolean };

const statusLabel: Record<string, string> = {
  PENDING_VALIDATION: "Validar pago",
  PAYMENT_SENT: "Pago enviado",
  PAID: "Listo para despacho",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  CANCELLED_EXPIRED: "Vencido",
};

function money(value: number) { return `S/ ${Number(value || 0).toFixed(2)}`; }
function stock(product: Product) { return product.variants.reduce((total, variant) => total + Number(variant.stock ?? 0), 0); }
function dateLabel(value: any) {
  try { return value?.toDate?.().toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) ?? "—"; } catch { return "—"; }
}

function Status({ status }: { status: string }) {
  const tone = status === "PAID" ? "blue" : status === "PENDING_VALIDATION" || status === "PAYMENT_SENT" ? "amber" : status === "SHIPPED" || status === "DELIVERED" ? "green" : "slate";
  return <span className={`admin-status admin-status--${tone}`}>{statusLabel[status] ?? status}</span>;
}

function Metric({ label, value, detail, tone = "blue" }: { label: string; value: string | number; detail: string; tone?: "blue" | "amber" | "rose" }) {
  return <div className={`admin-metric admin-metric--${tone}`}><p>{label}</p><strong>{value}</strong><span>{detail}</span></div>;
}

function Task({ title, detail, count, href, tone }: { title: string; detail: string; count: number; href: string; tone: "amber" | "blue" | "rose" }) {
  return <Link href={href} className={`admin-task admin-task--${tone}`}><span className="admin-task__count">{count}</span><span className="min-w-0"><b>{title}</b><small>{detail}</small></span><span aria-hidden="true">→</span></Link>;
}

export default async function DashboardHome() {
  let ordersSnapshot: any = null;
  let productsSnapshot: any = null;
  try {
    [ordersSnapshot, productsSnapshot] = await Promise.all([
      adminDb.collection("orders").orderBy("createdAt", "desc").limit(80).get(),
      adminDb.collection("products").orderBy("updatedAt", "desc").limit(500).get().catch(() => null),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("NOT_FOUND")) throw error;
  }

  const orders: Order[] = (ordersSnapshot?.docs ?? []).map((document: any) => {
    const data = document.data() as any;
    return { id: document.id, publicCode: String(data.publicCode ?? document.id), status: String(data.status ?? ""), email: data.customer?.email, total: Number(data.totals?.totalToPay ?? 0), createdAt: dateLabel(data.createdAt), deletedAt: Boolean(data.deletedAt) };
  }).filter((order: Order) => !order.deletedAt);

  const products: Product[] = (productsSnapshot?.docs ?? []).map((document: any) => {
    const data = document.data() as any;
    return { id: document.id, name: String(data.name ?? ""), slug: String(data.slug ?? document.id), status: String(data.status ?? "active"), images: Array.isArray(data.images) ? data.images : [], variants: Array.isArray(data.variants) ? data.variants : [], deletedAt: Boolean(data.deletedAt) };
  }).filter((product: Product) => !product.deletedAt);

  const paymentQueue = orders.filter((order) => order.status === "PENDING_VALIDATION" || order.status === "PAYMENT_SENT");
  const readyToShip = orders.filter((order) => order.status === "PAID");
  const confirmedRevenue = orders.filter((order) => ["PAID", "SHIPPED", "DELIVERED"].includes(order.status)).reduce((sum, order) => sum + order.total, 0);
  const catalogIssues = products.filter((product) => product.status === "active" && (!product.name || product.images.length === 0 || product.variants.length === 0 || stock(product) <= 0));
  const lowStock = products.filter((product) => product.status === "active" && stock(product) > 0 && stock(product) <= 3);
  const recentOrders = orders.slice(0, 7);

  return (
    <div className="admin-overview grid gap-5">
      <section className="admin-overview__hero">
        <div>
          <p>OPERACIÓN DE LA TIENDA</p>
          <h1>Hoy tienes <span>{paymentQueue.length + readyToShip.length + catalogIssues.length}</span> prioridades</h1>
          <span>Empieza por pagos, luego despachos y finalmente los productos que bloquean ventas.</span>
        </div>
        <div className="admin-overview__actions">
          <Link href="/dashboard/orders">Ver pedidos</Link>
          <Link href="/dashboard/products">Administrar catálogo</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Pagos por validar" value={paymentQueue.length} detail={paymentQueue.length ? "Requieren revisión" : "Sin pagos pendientes"} tone="amber" />
        <Metric label="Listos para enviar" value={readyToShip.length} detail={readyToShip.length ? "Ya están pagados" : "Sin despachos pendientes"} />
        <Metric label="Ventas confirmadas" value={money(confirmedRevenue)} detail={`${orders.length} pedidos activos`} tone="blue" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="admin-panel">
          <div className="admin-panel__heading"><div><p>COLA DE TRABAJO</p><h2>Qué hacer ahora</h2></div><Link href="/dashboard/orders">Abrir operación →</Link></div>
          <div className="grid gap-2">
            <Task title="Validar pagos" detail="Confirma comprobantes antes de preparar pedidos." count={paymentQueue.length} href="/dashboard/orders" tone="amber" />
            <Task title="Preparar despachos" detail="Pedidos pagados que deben pasar a envío." count={readyToShip.length} href="/dashboard/orders" tone="blue" />
            <Task title="Corregir catálogo" detail="Productos sin stock, imagen o datos necesarios." count={catalogIssues.length} href="/dashboard/products" tone="rose" />
          </div>
        </div>
        <div className="admin-panel admin-catalog-health">
          <div className="admin-panel__heading"><div><p>ESTADO DEL CATÁLOGO</p><h2>Disponibilidad</h2></div><Link href="/dashboard/inventory">Inventario →</Link></div>
          <div className="admin-catalog-health__row"><span>Productos activos</span><b>{products.filter((product) => product.status === "active").length}</b></div>
          <div className="admin-catalog-health__row"><span>Stock bajo</span><b className="text-amber-600">{lowStock.length}</b></div>
          <div className="admin-catalog-health__row"><span>Por corregir</span><b className="text-rose-600">{catalogIssues.length}</b></div>
          <Link href="/dashboard/products" className="admin-catalog-health__cta">Revisar productos</Link>
        </div>
      </section>

      <section className="admin-panel overflow-hidden p-0">
        <div className="admin-panel__heading px-5 py-4"><div><p>PEDIDOS RECIENTES</p><h2>Última actividad</h2></div><Link href="/dashboard/orders">Ver todos →</Link></div>
        {!recentOrders.length ? <div className="px-5 py-10 text-center text-sm text-slate-500">Aún no hay pedidos registrados.</div> : <div className="overflow-x-auto"><table className="admin-recent-orders"><thead><tr><th>Pedido</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Fecha</th></tr></thead><tbody>{recentOrders.map((order) => <tr key={order.id}><td><b>{order.publicCode}</b></td><td>{order.email ?? "—"}</td><td><Status status={order.status} /></td><td><b>{money(order.total)}</b></td><td>{order.createdAt}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
