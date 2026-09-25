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
  LOW: { label: "Reponer", style: "border-amber-200 bg-amber-50 text-amber-700" },
  HEALTHY: { label: "Disponible", style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};

function formatDate(ms: number | null): string {
  return ms ? new Date(ms).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) : "Sin movimientos";
}

function variantLabel(variant: Variant): string {
  return [variant.size && `Talla ${variant.size}`, variant.color, variant.sku && `SKU ${variant.sku}`].filter(Boolean).join(" · ") || "Variante principal";
}

export default function InventoryClient() {
  const routeParams = useSearchParams();
  const routeState = routeParams.get("state");
  const initialState: "ALL" | InventoryState = routeState === "OUT" || routeState === "LOW" || routeState === "HEALTHY" ? routeState : "LOW";
  const [items, setItems] = useState<InventoryProduct[]>([]);
  const [state, setState] = useState<"ALL" | InventoryState>(initialState);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deltas, setDeltas] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, "RECEIPT" | "CORRECTION" | "DAMAGE" | "RETURN">>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
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
      const nextItems = json.items as InventoryProduct[];
      setItems((previous) => mode === "replace" ? nextItems : [...previous, ...nextItems]);
      setCursor(json.nextCursor ?? null);
      setSelectedId((current) => {
        // Loading another page must not steal the operator away from the item
        // currently being adjusted.
        if (mode === "append" && current) return current;
        return current && nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el inventario");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [search, state]);

  useEffect(() => { void load("replace"); }, [load]);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const summary = useMemo(() => ({
    out: items.filter((item) => item.inventoryState === "OUT").length,
    low: items.filter((item) => item.inventoryState === "LOW").length,
    units: items.reduce((sum, item) => sum + item.inventoryTotal, 0),
  }), [items]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setSearch(draftSearch.trim());
  }

  async function adjust(product: InventoryProduct, variant: Variant) {
    const key = `${product.id}:${variant.id}`;
    const delta = Number(deltas[key] ?? "0");
    if (!Number.isInteger(delta) || delta === 0) {
      setNotice("Indica una cantidad entera, positiva o negativa, antes de aplicar el movimiento.");
      return;
    }
    setBusyKey(key);
    setNotice(null);
    try {
      const result = await apiPost<{ inventoryTotal: number; inventoryState: InventoryState; variantStock: number; status: string }>(
        "/api/admin/inventory/adjust",
        { productId: product.id, variantId: variant.id, delta, reason: reasons[key] ?? (delta > 0 ? "RECEIPT" : "CORRECTION"), note: notes[key]?.trim() || undefined },
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
      setNotes((all) => ({ ...all, [key]: "" }));
      setNotice(`${product.name}: movimiento registrado. El nuevo stock ya está disponible para la tienda.`);
    } catch (err) {
      setNotice(`Error: ${err instanceof Error ? err.message : "No se pudo registrar el movimiento"}`);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="admin-inventory grid gap-5">
      <section className="admin-inventory__hero">
        <div>
          <p>OPERACIÓN DE STOCK</p>
          <h1>Reposición y movimientos</h1>
          <span>Revisa lo urgente, ajusta por variante y conserva un historial de cada movimiento.</span>
        </div>
        <Link href="/dashboard/products" className="admin-inventory__hero-action">Administrar productos</Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="admin-metric admin-metric--rose"><p>Agotados</p><strong>{summary.out}</strong><span>Productos no vendibles</span></div>
        <div className="admin-metric admin-metric--amber"><p>Por reponer</p><strong>{summary.low}</strong><span>Prioridad de compra</span></div>
        <div className="admin-metric admin-metric--blue"><p>Unidades en vista</p><strong>{summary.units}</strong><span>Según el filtro actual</span></div>
      </section>

      <section className="admin-inventory__toolbar">
        <div className="admin-inventory__filters" aria-label="Filtro de inventario">
          {(["LOW", "OUT", "HEALTHY", "ALL"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setState(value)} className={state === value ? "is-active" : ""}>
              {value === "ALL" ? "Todo" : STATE_COPY[value].label}
            </button>
          ))}
        </div>
        <form onSubmit={submitSearch} className="admin-inventory__search">
          <input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Buscar producto, marca o SKU" />
          <button type="submit">Buscar</button>
        </form>
      </section>

      {notice && <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.startsWith("Error") ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{notice}</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
        <div className="admin-stock-table">
          <div className="admin-stock-table__heading"><div><p>COLA DE INVENTARIO</p><h2>{state === "LOW" ? "Productos que requieren reposición" : "Productos del inventario"}</h2></div><button type="button" onClick={() => void load("replace")}>Actualizar</button></div>
          {loading ? <div className="space-y-3 p-5">{Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div> : items.length === 0 ? (
            <div className="px-5 py-16 text-center"><p className="text-base font-black text-slate-900">No hay productos en esta vista</p><p className="mt-1 text-sm text-slate-500">Cambia el filtro o busca por nombre, marca o SKU.</p></div>
          ) : <div className="divide-y divide-slate-100">
            {items.map((product) => {
              const stateCopy = STATE_COPY[product.inventoryState] ?? STATE_COPY.OUT;
              const active = selected?.id === product.id;
              return <button key={product.id} type="button" onClick={() => setSelectedId(product.id)} className={`admin-stock-row ${active ? "is-selected" : ""}`}>
                <span className="min-w-0"><b>{product.name}</b><small>{[product.brand, product.productType, product.slug].filter(Boolean).join(" · ")}</small></span>
                <strong>{product.inventoryTotal}</strong>
                <span className={`admin-stock-state ${stateCopy.style}`}>{stateCopy.label}</span>
                <small className="admin-stock-date">{formatDate(product.inventoryUpdatedAtMs)}</small>
                <span className="admin-stock-row__arrow" aria-hidden="true">→</span>
              </button>;
            })}
          </div>}
          {cursor && !search && <div className="border-t border-slate-100 p-4 text-center"><button type="button" disabled={loadingMore} onClick={() => void load("append", cursor)} className="admin-load-more">{loadingMore ? "Cargando…" : "Cargar más productos"}</button></div>}
        </div>

        <aside className="admin-stock-adjuster">
          {!selected ? <div className="admin-stock-adjuster__empty"><b>Selecciona un producto</b><span>Elige una fila para ajustar sus variantes sin perder el contexto de la reposición.</span></div> : <>
            <div className="admin-stock-adjuster__header"><div><p>AJUSTE RÁPIDO</p><h2>{selected.name}</h2><span>{selected.brand || "Sin marca"} · Stock total: <b>{selected.inventoryTotal}</b></span></div><Link href={`/dashboard/products?edit=${encodeURIComponent(selected.id)}`}>Editar ficha</Link></div>
            <div className="grid gap-3">
              {selected.variants.map((variant) => {
                const key = `${selected.id}:${variant.id}`;
                const delta = Number(deltas[key] ?? 0);
                const after = variant.stock + (Number.isFinite(delta) ? delta : 0);
                const busy = busyKey === key;
                return <div key={variant.id} className="admin-stock-variant">
                  <div className="flex items-start justify-between gap-3"><div><b>{variantLabel(variant)}</b><span>Disponible ahora: <strong>{variant.stock}</strong></span></div><span className="admin-stock-after">Después: {after}</span></div>
                  <div className="grid gap-2 sm:grid-cols-[126px_minmax(0,1fr)_auto]">
                    <input aria-label={`Movimiento para ${variantLabel(variant)}`} value={deltas[key] ?? ""} onChange={(event) => setDeltas((all) => ({ ...all, [key]: event.target.value }))} type="number" step="1" placeholder="+ / − unidades" />
                    <select value={reasons[key] ?? (delta < 0 ? "CORRECTION" : "RECEIPT")} onChange={(event) => setReasons((all) => ({ ...all, [key]: event.target.value as "RECEIPT" | "CORRECTION" | "DAMAGE" | "RETURN" }))}><option value="RECEIPT">Ingreso de compra</option><option value="CORRECTION">Corrección</option><option value="DAMAGE">Merma o daño</option><option value="RETURN">Devolución</option></select>
                    <button type="button" disabled={busy} onClick={() => void adjust(selected, variant)}>{busy ? "Guardando" : "Aplicar"}</button>
                  </div>
                  <input aria-label={`Nota del movimiento para ${variantLabel(variant)}`} value={notes[key] ?? ""} onChange={(event) => setNotes((all) => ({ ...all, [key]: event.target.value }))} maxLength={240} placeholder="Nota opcional para auditoría: OC, proveedor o incidencia" />
                </div>;
              })}
            </div>
            <p className="admin-stock-adjuster__note">Cada ajuste se guarda como transacción: no permite stock negativo y conserva usuario, motivo y fecha.</p>
          </>}
        </aside>
      </section>
    </div>
  );
}
