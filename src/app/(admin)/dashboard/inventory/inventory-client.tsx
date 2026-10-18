"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { inventoryErrorMessage, previewStockMovement, type StockDirection, type StockMovementReason } from "@/lib/adminInventory";

type InventoryState = "OUT" | "LOW" | "HEALTHY";
type Variant = { id: string; size?: string; color?: string; sku?: string; stock: number };
type InventoryProduct = {
  id: string; name: string; slug: string; brand: string; productType: string; status: string;
  inventoryTotal: number; inventoryState: InventoryState; inventoryUpdatedAtMs: number | null; variants: Variant[];
};
type MovementDraft = { quantity: string; direction: StockDirection; reason: StockMovementReason; note: string };

const STATE_COPY: Record<InventoryState, { label: string; style: string }> = {
  OUT: { label: "Agotado", style: "border-rose-200 bg-rose-50 text-rose-700" },
  LOW: { label: "Por reponer", style: "border-amber-200 bg-amber-50 text-amber-700" },
  HEALTHY: { label: "Disponible", style: "border-emerald-200 bg-emerald-50 text-emerald-700" },
};
const REASONS: Record<StockMovementReason, string> = {
  RECEIPT: "Ingreso de mercadería", RETURN: "Devolución del cliente", CORRECTION: "Corrección de inventario", DAMAGE: "Merma o daño",
};
const EMPTY_DRAFT: MovementDraft = { quantity: "", direction: "ADD", reason: "RECEIPT", note: "" };

function formatDate(ms: number | null): string {
  return ms ? new Date(ms).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }) : "Sin movimientos";
}

function variantLabel(variant: Variant): string {
  return [variant.size && `Talla ${variant.size}`, variant.color].filter(Boolean).join(" · ") || "Variante principal";
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
  const [searchLimited, setSearchLimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, MovementDraft>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const request = useRef<{ sequence: number; controller: AbortController | null }>({ sequence: 0, controller: null });
  const saving = useRef(false);
  const detailPanel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!detailOpen || !window.matchMedia("(max-width: 1279px)").matches) return;
    detailPanel.current?.focus({ preventScroll: true });
    detailPanel.current?.scrollIntoView({ block: "start" });
  }, [detailOpen]);

  const load = useCallback(async (mode: "replace" | "append", nextCursor?: string | null) => {
    request.current.controller?.abort();
    const controller = new AbortController();
    const sequence = ++request.current.sequence;
    request.current.controller = controller;
    if (mode === "replace") {
      setLoading(true);
      setItems([]);
      setCursor(null);
    } else setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (state !== "ALL") params.set("state", state);
      if (search) params.set("q", search);
      if (nextCursor) params.set("cursor", nextCursor);
      const response = await fetch(`/api/admin/inventory?${params.toString()}`, { cache: "no-store", signal: controller.signal });
      const json = await response.json();
      if (!response.ok) throw new Error(String(json?.error ?? "LOAD_FAILED"));
      if (sequence !== request.current.sequence) return;
      const nextItems = json.items as InventoryProduct[];
      setItems((previous) => mode === "replace" ? nextItems : Array.from(new Map([...previous, ...nextItems].map((item) => [item.id, item])).values()));
      setCursor(json.nextCursor ?? null);
      setSearchLimited(Boolean(json.searchLimited));
      setSelectedId((current) => {
        if (mode === "append" && current) return current;
        return current && nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id ?? null;
      });
    } catch (err) {
      if (controller.signal.aborted || sequence !== request.current.sequence) return;
      setError(inventoryErrorMessage(err instanceof Error ? err.message : "LOAD_FAILED"));
    } finally {
      if (sequence === request.current.sequence) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [search, state]);

  useEffect(() => {
    const activeRequest = request.current;
    setDetailOpen(false);
    void load("replace");
    return () => { activeRequest.controller?.abort(); };
  }, [load]);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const summary = useMemo(() => ({
    out: items.filter((item) => item.inventoryState === "OUT").length,
    low: items.filter((item) => item.inventoryState === "LOW").length,
    units: items.reduce((sum, item) => sum + item.inventoryTotal, 0),
  }), [items]);

  function updateDraft(key: string, changes: Partial<MovementDraft>) {
    setDrafts((all) => ({ ...all, [key]: { ...(all[key] ?? EMPTY_DRAFT), ...changes } }));
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (search === draftSearch.trim()) void load("replace");
    else setSearch(draftSearch.trim());
  }

  async function adjust(product: InventoryProduct, variant: Variant) {
    if (saving.current) return;
    const key = `${product.id}:${variant.id}`;
    const draft = drafts[key] ?? EMPTY_DRAFT;
    const preview = previewStockMovement(variant.stock, draft.quantity, draft.direction);
    if (preview.error) {
      setNotice({ type: "error", text: preview.error });
      return;
    }
    saving.current = true;
    setBusyKey(key);
    setNotice(null);
    try {
      const result = await apiPost<{ inventoryTotal: number; inventoryState: InventoryState; variantStock: number; status: string }>(
        "/api/admin/inventory/adjust",
        { productId: product.id, variantId: variant.id, delta: preview.delta, reason: draft.reason, note: draft.note.trim() || undefined },
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
      updateDraft(key, { quantity: "", note: "" });
      setNotice({ type: "success", text: `${product.name} · ${variantLabel(variant)}: ${preview.delta > 0 ? "+" : ""}${preview.delta} unidades. Stock actual: ${result.variantStock}.` });
    } catch (err) {
      setNotice({ type: "error", text: inventoryErrorMessage(err instanceof Error ? err.message : "SAVE_FAILED") });
    } finally {
      saving.current = false;
      setBusyKey(null);
    }
  }

  return (
    <div className="admin-inventory grid gap-5">
      <section className="admin-inventory__hero">
        <div><p>CATÁLOGO / CONTROL DE STOCK</p><h1>Inventario</h1><span>Consulta existencias y registra entradas o salidas por talla y color.</span></div>
        <Link href="/dashboard/products" className="admin-inventory__hero-action">Gestionar productos <span aria-hidden="true">↗</span></Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumen de los productos cargados">
        <div className="admin-metric admin-metric--rose"><p>Agotados en esta vista</p><strong>{loading ? "—" : summary.out}</strong><span>Sin unidades disponibles</span></div>
        <div className="admin-metric admin-metric--amber"><p>Por reponer en esta vista</p><strong>{loading ? "—" : summary.low}</strong><span>Entre 1 y 3 unidades</span></div>
        <div className="admin-metric"><p>Unidades en esta vista</p><strong>{loading ? "—" : summary.units}</strong><span>{loading ? "Cargando productos" : `${items.length} productos cargados`}</span></div>
      </section>

      <section className="admin-inventory__toolbar">
        <div className="admin-inventory__filters" role="group" aria-label="Filtrar por existencias">
          {(["ALL", "LOW", "OUT", "HEALTHY"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={state === value} disabled={Boolean(busyKey)} onClick={() => setState(value)} className={state === value ? "is-active" : ""}>
              {value === "ALL" ? "Todos" : STATE_COPY[value].label}
            </button>
          ))}
        </div>
        <form onSubmit={submitSearch} className="admin-inventory__search" role="search">
          <label htmlFor="inventory-search" className="sr-only">Buscar por nombre, marca o SKU</label>
          <input id="inventory-search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} maxLength={120} disabled={Boolean(busyKey)} placeholder="Nombre, marca o SKU…" />
          <button type="submit" disabled={Boolean(busyKey) || loading}>Buscar</button>
        </form>
      </section>

      {search && <p className="admin-inventory__scope flex flex-wrap items-center gap-2 text-xs text-slate-600">Búsqueda: <b>«{search}»</b><button type="button" className="underline underline-offset-2" disabled={Boolean(busyKey)} onClick={() => { setSearch(""); setDraftSearch(""); }}>Limpiar búsqueda</button>{searchLimited && <span>· Hasta 100 coincidencias por palabra.</span>}</p>}
      {notice && <div role={notice.type === "error" ? "alert" : "status"} className={`flex items-start justify-between gap-3 rounded border px-4 py-3 text-sm ${notice.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><span>{notice.text}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setNotice(null)}>×</button></div>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button type="button" disabled={Boolean(busyKey)} onClick={() => void load("replace")} className="font-semibold underline">Volver a intentar</button></div>}

      <section className="admin-inventory__layout grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
        <div className={`admin-stock-table ${detailOpen ? "hidden xl:block" : ""}`}>
          <div className="admin-stock-table__heading"><div><p>EXISTENCIAS</p><h2>{state === "LOW" ? "Productos por reponer" : state === "OUT" ? "Productos agotados" : state === "HEALTHY" ? "Productos disponibles" : "Todos los productos"}</h2></div><button type="button" disabled={loading || loadingMore || Boolean(busyKey)} onClick={() => void load("replace")}>{loading ? "Actualizando…" : "Actualizar"}</button></div>
          {loading ? <div className="space-y-3 p-5" role="status" aria-label="Cargando inventario">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded bg-slate-100" />)}</div> : items.length === 0 ? (
            <div className="px-5 py-12 text-center"><p className="text-base font-semibold text-slate-900">{error ? "No se pudo cargar esta vista" : "No hay productos en esta vista"}</p><p className="mt-1 text-sm text-slate-500">{error ? "Vuelve a intentar con el botón de arriba." : "Prueba otro filtro o busca por nombre, marca o SKU."}</p>{!error && (state !== "ALL" || search) && <button type="button" className="mt-4 text-sm font-semibold underline" onClick={() => { setState("ALL"); setSearch(""); setDraftSearch(""); }}>Ver todo el inventario</button>}</div>
          ) : <div className="divide-y divide-slate-100">
            {items.map((product) => {
              const stateCopy = STATE_COPY[product.inventoryState] ?? STATE_COPY.OUT;
              const active = selected?.id === product.id;
              return <button key={product.id} type="button" aria-pressed={active} disabled={Boolean(busyKey)} onClick={() => { setSelectedId(product.id); setDetailOpen(true); }} className={`admin-stock-row ${active ? "is-selected" : ""}`}>
                <span className="min-w-0"><b>{product.name}</b><small>{[product.brand, product.productType, product.status === "archived" ? "No publicado" : "Publicado"].filter(Boolean).join(" · ")}</small></span>
                <strong aria-label={`${product.inventoryTotal} unidades`}>{product.inventoryTotal}</strong>
                <span className={`admin-stock-state ${stateCopy.style}`}>{stateCopy.label}</span>
                <small className="admin-stock-date">{formatDate(product.inventoryUpdatedAtMs)}</small>
                <span className="admin-stock-row__arrow" aria-hidden="true">→</span>
              </button>;
            })}
          </div>}
          {!loading && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4"><p className="admin-inventory__scope text-xs text-slate-500">{items.length} productos cargados{cursor ? " · Hay más resultados" : ""}</p>{cursor && !search && <button type="button" disabled={loadingMore || Boolean(busyKey)} onClick={() => void load("append", cursor)} className="admin-load-more">{loadingMore ? "Cargando…" : "Cargar más"}</button>}</div>}
        </div>

        <aside ref={detailPanel} tabIndex={-1} className={`admin-stock-adjuster ${detailOpen ? "" : "hidden xl:block"}`} aria-label="Movimientos del producto seleccionado">
          <button type="button" className="admin-stock-adjuster__back mb-4 text-sm font-semibold xl:hidden" disabled={Boolean(busyKey)} onClick={() => setDetailOpen(false)}>← Volver al inventario</button>
          {!selected || loading ? <div className="admin-stock-adjuster__empty"><b>{loading ? "Cargando existencias…" : "Selecciona un producto"}</b><span>Abre un producto para consultar sus variantes y registrar un movimiento.</span></div> : <>
            <div className="admin-stock-adjuster__header"><div><p>REGISTRAR MOVIMIENTO</p><h2>{selected.name}</h2><span>{selected.brand || "Sin marca"} · <b>{selected.inventoryTotal}</b> unidades totales</span></div><Link href={`/dashboard/products?edit=${encodeURIComponent(selected.id)}`}>Editar ficha ↗</Link></div>
            {selected.status === "archived" && <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Este producto no está publicado. Revisa su estado en la ficha después de reponer.</p>}
            {selected.variants.length === 0 ? <p className="text-sm text-slate-600">Este producto aún no tiene variantes. Añade una talla o variante en <Link href={`/dashboard/products?edit=${encodeURIComponent(selected.id)}`} className="font-semibold underline">Editar ficha</Link> para gestionar su stock.</p> : <div className="grid gap-3">
              {selected.variants.map((variant) => {
                const key = `${selected.id}:${variant.id}`;
                const draft = drafts[key] ?? EMPTY_DRAFT;
                const preview = previewStockMovement(variant.stock, draft.quantity, draft.direction);
                const busy = busyKey === key;
                const validationId = `stock-validation-${key}`;
                const allowedReasons: StockMovementReason[] = draft.direction === "ADD" ? ["RECEIPT", "RETURN", "CORRECTION"] : ["CORRECTION", "DAMAGE"];
                return <fieldset key={variant.id} disabled={Boolean(busyKey) || loadingMore} className="admin-stock-variant min-w-0">
                  <legend className="sr-only">Movimiento para {variantLabel(variant)}</legend>
                  <div className="flex items-start justify-between gap-3"><div><b>{variantLabel(variant)}</b>{variant.sku && <span>SKU: {variant.sku}</span>}<span>Disponible: <strong>{variant.stock}</strong> {variant.stock === 1 ? "unidad" : "unidades"}</span></div><span className="admin-stock-after">{selected.variants.length === 1 ? "Única variante" : "Por variante"}</span></div>
                  <div className="admin-stock-variant__movement mt-3 grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-xs font-semibold text-slate-600">Movimiento<select value={draft.direction} aria-label={`Tipo de movimiento para ${variantLabel(variant)}`} onChange={(event) => { const direction = event.target.value as StockDirection; updateDraft(key, { direction, reason: direction === "ADD" ? "RECEIPT" : "CORRECTION" }); }}><option value="ADD">Añadir unidades</option><option value="REMOVE">Retirar unidades</option></select></label>
                    <label className="grid gap-1 text-xs font-semibold text-slate-600">Cantidad<input aria-label={`Cantidad para ${variantLabel(variant)}`} aria-describedby={validationId} aria-invalid={Boolean(draft.quantity && preview.error)} value={draft.quantity} onChange={(event) => updateDraft(key, { quantity: event.target.value })} type="number" inputMode="numeric" min="1" max="100000" step="1" placeholder="0" /></label>
                  </div>
                  <label className="mt-2 grid gap-1 text-xs font-semibold text-slate-600">Motivo<select value={draft.reason} onChange={(event) => updateDraft(key, { reason: event.target.value as StockMovementReason })}>{allowedReasons.map((reason) => <option key={reason} value={reason}>{REASONS[reason]}</option>)}</select></label>
                  <label className="mt-2 grid gap-1 text-xs font-semibold text-slate-600">Nota opcional<input aria-label={`Nota para ${variantLabel(variant)}`} value={draft.note} onChange={(event) => updateDraft(key, { note: event.target.value })} maxLength={240} placeholder="Proveedor, comprobante o detalle" /></label>
                  <div id={validationId} className={`admin-stock-preview mt-3 text-xs ${draft.quantity && preview.error ? "is-invalid text-rose-700" : "text-slate-600"}`} aria-live="polite">{draft.quantity && preview.error ? preview.error : draft.quantity && !preview.error ? <>Stock después del movimiento: <strong>{variant.stock} → {preview.after}</strong></> : "Indica la cantidad para revisar el stock final."}</div>
                  <button type="button" className="mt-3 w-full" disabled={Boolean(preview.error) || Boolean(busyKey) || loadingMore} onClick={() => void adjust(selected, variant)}>{busy ? "Guardando…" : draft.direction === "REMOVE" ? "Registrar salida" : "Registrar entrada"}</button>
                </fieldset>;
              })}
            </div>}
            <p className="admin-stock-adjuster__note">Cada movimiento guarda fecha, responsable y motivo. El stock se actualiza al registrar la entrada o salida.</p>
          </>}
        </aside>
      </section>
    </div>
  );
}
