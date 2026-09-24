"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";

type InventoryState = "OUT" | "LOW" | "HEALTHY";
type Variant = { id: string; size?: string; color?: string; sku?: string; stock: number };
type InventoryProduct = {
  id: string; name: string; slug: string; brand: string; productType: string; status: string;
  inventoryTotal: number; inventoryState: InventoryState; inventoryUpdatedAtMs: number | null; variants: Variant[];
};

const STATE_COPY: Record<InventoryState, { label: string; style: string }> = {
  OUT: { label: "Agotado", style: "border-rose-200 bg-rose-50 text-rose-700" },
  LOW: { label: "Reposición", style: "border-amber-200 bg-amber-50 text-amber-700" },
  HEALTHY: { label: "Disponible", style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

function formatDate(ms: number | null): string {
  return ms ? new Date(ms).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) : "—";
}

export default function InventoryClient() {
  const routeParams = useSearchParams();
  const routeState = routeParams.get("state");
  const initialState: "ALL" | InventoryState = routeState === "OUT" || routeState === "LOW" || routeState === "HEALTHY" ? routeState : "ALL";
  const [items, setItems] = useState<InventoryProduct[]>([]);
  const [state, setState] = useState<"ALL" | InventoryState>(initialState);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, "RECEIPT" | "CORRECTION" | "DAMAGE" | "RETURN">>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (mode: "replace" | "append", nextCursor?: string | null) => {
    mode === "replace" ? setLoading(true) : setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (state !== "ALL") params.set("state", state);
      if (search) params.set("q", search);
      if (nextCursor) params.set("cursor", nextCursor);
      const response = await fetch(`/api/admin/inventory?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(String(json?.error ?? "No se pudo cargar el inventario"));
      setItems((previous) => mode === "replace" ? json.items : [...previous, ...json.items]);
      setCursor(json.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el inventario");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, state]);

  useEffect(() => { void load("replace"); }, [load]);

  const summary = useMemo(() => ({
    out: items.filter((item) => item.inventoryState === "OUT").length,
    low: items.filter((item) => item.inventoryState === "LOW").length,
    total: items.reduce((sum, item) => sum + item.inventoryTotal, 0),
  }), [items]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearch(draftSearch.trim());
  }

  async function adjust(product: InventoryProduct, variant: Variant) {
    const key = `${product.id}:${variant.id}`;
    const delta = Number(deltas[key] ?? "0");
    if (!Number.isInteger(delta) || delta === 0) {
      setNotice("Indica una cantidad entera distinta de cero.");
      return;
    }
    setBusyKey(key); setNotice(null);
    try {
      const result = await apiPost<{ inventoryTotal: number; inventoryState: InventoryState; variantStock: number; status: string }>(
        "/api/admin/inventory/adjust",
        { productId: product.id, variantId: variant.id, delta, reason: reason[key] ?? (delta > 0 ? "RECEIPT" : "CORRECTION") },
        { csrfCookieName: CSRF_COOKIE_NAME }
      );
      setItems((all) => all.map((item) => item.id !== product.id ? item : {
        ...item,
        inventoryTotal: result.inventoryTotal,
        inventoryState: result.inventoryState,
        status: result.status,
        inventoryUpdatedAtMs: Date.now(),
        variants: item.variants.map((current) => current.id === variant.id ? { ...current, stock: result.variantStock } : current),
      }));
      setDeltas((all) => ({ ...all, [key]: "" }));
      setNotice(`Stock de ${product.name} actualizado y registrado en el historial.`);
    } catch (err) {
      setNotice(`Error: ${err instanceof Error ? err.message : "No se pudo ajustar"}`);
    } finally { setBusyKey(null); }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Control operativo</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Inventario, sin hojas de cálculo</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Prioriza faltantes, ajusta cada variante con seguridad y deja un registro auditable de cada movimiento.</p>
          </div>
          <Link href="/dashboard/products" className="inline-flex h-10 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-slate-900 hover:bg-emerald-50">Editar catálogo</Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Unidades en esta vista", summary.total, "bg-slate-700"],
          ["Productos agotados", summary.out, "bg-rose-500"],
          ["Requieren reposición", summary.low, "bg-amber-500"],
        ].map(([label, value, accent]) => <div key={String(label)} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`absolute inset-y-0 left-0 w-1 ${accent}`} /><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-3xl font-black tabular-nums text-slate-950">{value}</p></div>)}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" aria-label="Filtro de estado de inventario">
            {(["ALL", "OUT", "LOW", "HEALTHY"] as const).map((value) => <button key={value} type="button" onClick={() => setState(value)} className={`rounded-xl border px-3 py-2 text-xs font-black transition ${state === value ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>{value === "ALL" ? "Todo el inventario" : STATE_COPY[value].label}</button>)}
          </div>
          <form onSubmit={submitSearch} className="flex gap-2">
            <input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 sm:w-72" placeholder="Busca por nombre o marca" />
            <button className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700">Buscar</button>
          </form>
        </div>
        {search && <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600"><span>Resultados para <strong>“{search}”</strong></span><button type="button" onClick={() => { setDraftSearch(""); setSearch(""); }} className="font-bold text-rose-600">Limpiar</button></div>}
      </section>

      {notice && <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${notice.startsWith("Error") ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(190px,1.8fr)_80px_120px_100px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500 sm:px-5"><span>Producto</span><span className="text-right">Stock</span><span>Estado</span><span>Actualizado</span></div>
        {loading ? <div className="space-y-3 p-5">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div> : items.length === 0 ? <div className="px-5 py-16 text-center"><p className="text-base font-black text-slate-900">No hay productos en esta vista</p><p className="mt-1 text-sm text-slate-500">Si acabas de activar este módulo, ejecuta la sincronización inicial de inventario.</p></div> : <div className="divide-y divide-slate-100">
          {items.map((product) => {
            const stateCopy = STATE_COPY[product.inventoryState] ?? STATE_COPY.OUT;
            const expanded = openId === product.id;
            return <div key={product.id}>
              <button type="button" onClick={() => setOpenId(expanded ? null : product.id)} className="grid w-full grid-cols-[minmax(190px,1.8fr)_80px_120px_100px] items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5">
                <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-900">{product.name}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{[product.brand, product.productType, product.slug].filter(Boolean).join(" · ")}</span></span>
                <span className="text-right text-lg font-black tabular-nums text-slate-950">{product.inventoryTotal}</span>
                <span><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${stateCopy.style}`}>{stateCopy.label}</span></span>
                <span className="text-xs font-medium text-slate-500">{formatDate(product.inventoryUpdatedAtMs)}</span>
              </button>
              {expanded && <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 sm:px-5"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Variantes y movimientos</p><Link href={`/dashboard/products?edit=${encodeURIComponent(product.id)}`} className="text-xs font-bold text-emerald-700 hover:underline">Abrir ficha completa</Link></div><div className="grid gap-2">
                {product.variants.map((variant) => { const key = `${product.id}:${variant.id}`; const busy = busyKey === key; return <div key={variant.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 lg:grid-cols-[minmax(180px,1fr)_80px_130px_150px_100px]"><div><p className="text-sm font-bold text-slate-900">{[variant.size && `Talla ${variant.size}`, variant.color, variant.sku && `SKU ${variant.sku}`].filter(Boolean).join(" · ") || variant.id}</p><p className="text-xs text-slate-500">ID: {variant.id}</p></div><p className="self-center text-lg font-black tabular-nums text-slate-950">{variant.stock}</p><input aria-label={`Ajuste para ${variant.id}`} value={deltas[key] ?? ""} onChange={(event) => setDeltas((all) => ({ ...all, [key]: event.target.value }))} type="number" step="1" className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500" placeholder="+ / − cantidad" /><select value={reason[key] ?? (Number(deltas[key] ?? 0) < 0 ? "CORRECTION" : "RECEIPT")} onChange={(event) => setReason((all) => ({ ...all, [key]: event.target.value as any }))} className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm"><option value="RECEIPT">Ingreso de compra</option><option value="CORRECTION">Corrección</option><option value="DAMAGE">Merma / daño</option><option value="RETURN">Devolución</option></select><button type="button" disabled={busy} onClick={() => void adjust(product, variant)} className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-black text-white disabled:opacity-50 hover:bg-slate-700">{busy ? "Guardando" : "Aplicar"}</button></div>; })}
              </div></div>}
            </div>;
          })}
        </div>}
        {cursor && !search && <div className="border-t border-slate-100 p-4 text-center"><button type="button" disabled={loadingMore} onClick={() => void load("append", cursor)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{loadingMore ? "Cargando…" : "Cargar 50 productos más"}</button></div>}
      </section>
      <p className="text-xs text-slate-500">Cada ajuste se ejecuta como transacción: el stock nunca puede quedar negativo y el movimiento queda registrado con usuario, motivo y fecha.</p>
    </div>
  );
}
