"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";
import { normalizeToken } from "@/lib/searchTokens";
import { hasStock } from "@/lib/productStock";

type SortType = "latest" | "price-asc" | "price-desc" | "name";
type Audience = "hombre" | "mujer" | "ninos" | "todos";
type CatalogItem = ProductCardData & { productType?: string; audience?: Audience };

const AUDIENCE_LABEL: Record<Audience, string> = {
  hombre: "Hombre",
  mujer: "Mujer",
  ninos: "Niños",
  todos: "Todos",
};

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: "latest", label: "Recientes" },
  { value: "price-asc", label: "Precio ↑" },
  { value: "price-desc", label: "Precio ↓" },
  { value: "name", label: "A–Z" },
];

function supportsAudienceFilter(productType: string): boolean {
  const t = String(productType ?? "").toLowerCase();
  return t.includes("zapat") || t.includes("ropa");
}

function normalizeAudience(raw: unknown): Audience {
  const v = normalizeToken(String(raw ?? "")).replace(/\s+/g, "");
  if (v.startsWith("hombre")) return "hombre";
  if (v.startsWith("mujer")) return "mujer";
  if (v.startsWith("nino") || v.startsWith("nina")) return "ninos";
  return "todos";
}

function normalizeProductType(raw: unknown): string {
  return normalizeToken(String(raw ?? "")).replace(/\s+/g, "-");
}

function matchType(docTypeRaw: unknown, filterTypeRaw: string): boolean {
  const docType = normalizeProductType(docTypeRaw);
  const filterType = normalizeProductType(filterTypeRaw);
  if (!filterType) return true;
  if (!docType) return false;
  if (docType === filterType) return true;
  if (docType.includes(filterType)) return true;
  if (docType.includes("zapat") && filterType.includes("zapat")) return true;
  if (docType.includes("ropa") && filterType.includes("ropa")) return true;
  if (docType.includes("acces") && filterType.includes("acces")) return true;
  return false;
}

export default function CatalogClient({
  initialItems, initialQuery, initialType, initialAudience, productTypes,
}: {
  initialItems: CatalogItem[];
  initialQuery: string;
  initialType: string;
  initialAudience: string;
  productTypes: { key: string; label: string }[];
}) {
  const [qText, setQText] = useState(initialQuery ?? "");
  const token = useMemo(
    () => normalizeToken(qText).split(/\s+/g).filter(Boolean)[0] ?? "",
    [qText]
  );
  const [typeFilter, setTypeFilter] = useState<string>((initialType ?? "").toLowerCase().trim());
  const hasLockedType = Boolean((initialType ?? "").trim());
  const [audienceFilter, setAudienceFilter] = useState<Audience | "">(
    (["hombre", "mujer", "ninos", "todos"].includes((initialAudience ?? "").toLowerCase())
      ? (initialAudience.toLowerCase() as Audience)
      : "") as Audience | ""
  );
  const [sortBy, setSortBy] = useState<SortType>("latest");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<CatalogItem[] | null>(initialItems ?? []);
  const [error, setError] = useState<string | null>(null);

  // Cierra el dropdown sort al hacer click fuera
  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortOpen]);

  useEffect(() => { setQText(initialQuery ?? ""); }, [initialQuery]);
  useEffect(() => { setTypeFilter((initialType ?? "").toLowerCase().trim()); }, [initialType]);
  useEffect(() => {
    const normalizedAudience =
      ["hombre", "mujer", "ninos", "todos"].includes((initialAudience ?? "").toLowerCase())
        ? (initialAudience.toLowerCase() as Audience)
        : "";
    setAudienceFilter(normalizedAudience);
  }, [initialAudience]);

  useEffect(() => {
    let mounted = true;
    setError(null);
    if (!token) {
      setItems(initialItems ?? []);
      return () => { mounted = false; };
    }
    setItems(null);
    (async () => {
      try {
        const base = collection(db, "products");
        const q = query(base, where("status", "==", "active"), where("searchTokens", "array-contains", token), limit(50));
        const snap = await getDocs(q);
        const raw = snap.docs.map((d) => {
          const data = d.data() as any;
          const imgs = Array.isArray(data.images) ? [...data.images] : [];
          const sorted = imgs.sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
          const imageUrls = sorted.map((x: any) => String(x?.url ?? "")).filter(Boolean);
          const mainUrl = sorted.find((x: any) => x?.isMain)?.url ?? imageUrls[0];
          const updatedAtMs = typeof data?.updatedAt?.toMillis === "function" ? data.updatedAt.toMillis() : 0;
          const dedupeKey = String(data?.slug ?? data?.name ?? d.id).trim().toLowerCase();
          const variants = Array.isArray(data?.variants) ? data.variants : [];
          return {
            id: d.id, name: String(data.name ?? ""),
            price: Number(data.price ?? 0),
            salePrice: typeof data.salePrice === "number" ? data.salePrice : undefined,
            onSale: Boolean(data.onSale),
            imageUrl: typeof mainUrl === "string" ? mainUrl : undefined,
            imageUrls,
            productType: String(data?.productType ?? "").trim() || undefined,
            audience: normalizeAudience(data?.audience),
            hasStock: hasStock(variants),
            dedupeKey, updatedAtMs,
          };
        });
        const byLatest = raw.filter((x: any) => x.hasStock).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        const seen = new Set<string>();
        const list: CatalogItem[] = [];
        for (const it of byLatest) {
          if (seen.has(it.dedupeKey)) continue;
          seen.add(it.dedupeKey);
          list.push({ id: it.id, name: it.name, price: it.price, salePrice: it.salePrice, onSale: it.onSale, imageUrl: it.imageUrl, imageUrls: it.imageUrls, productType: it.productType, audience: it.audience });
        }
        if (mounted) setItems(list);
      } catch (e) {
        console.error(e);
        if (mounted) setError("No pudimos cargar el catálogo. Intenta nuevamente.");
      }
    })();
    return () => { mounted = false; };
  }, [token, initialItems]);

  const sortedItems = useMemo(() => {
    const base = [...(items ?? [])];
    const byType = typeFilter ? base.filter((p) => matchType(p.productType, typeFilter)) : base;
    const list =
      typeFilter && supportsAudienceFilter(typeFilter) && audienceFilter
        ? audienceFilter === "todos"
          ? byType
          : byType.filter((p) => (p.audience ?? "todos") === audienceFilter)
        : byType;
    if (sortBy === "name") return list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === "price-asc") return list.sort((a, b) => ((a.onSale && a.salePrice) ? a.salePrice : a.price) - ((b.onSale && b.salePrice) ? b.salePrice : b.price));
    if (sortBy === "price-desc") return list.sort((a, b) => ((b.onSale && b.salePrice) ? b.salePrice : b.price) - ((a.onSale && a.salePrice) ? a.salePrice : a.price));
    return list;
  }, [items, sortBy, typeFilter, audienceFilter]);

  useEffect(() => {
    if (!typeFilter || !supportsAudienceFilter(typeFilter)) {
      setAudienceFilter("");
    } else if (!audienceFilter) {
      setAudienceFilter("todos");
    }
  }, [typeFilter, audienceFilter]);

  // Pill helper
  const pill = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-150 cursor-pointer ${active
      ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
    }`;

  const activeCategoryLabel = productTypes.find(
    (t) => t.key.toLowerCase() === typeFilter.toLowerCase()
  )?.label ?? null;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header del catálogo ─────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0d1f15] via-slate-900 to-slate-800 px-4 py-6 sm:px-6">
        {/* Orb decorativo */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-60 rounded-full bg-emerald-600/8 blur-3xl" aria-hidden />

        <div className="relative mx-auto max-w-6xl flex items-center justify-between gap-4">
          {/* Bloque izquierdo */}
          <div className="flex items-stretch gap-3">
            {/* Acento vertical */}
            <div className="w-0.5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-700 shrink-0" />

            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] text-slate-500">Inicio</span>
                <svg className="h-2.5 w-2.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                <span className="text-[10px] font-semibold text-emerald-400">
                  {hasLockedType ? activeCategoryLabel : "Catálogo"}
                </span>
              </div>

              <h1 className="text-[1.5rem] sm:text-[1.9rem] font-display font-extrabold text-white leading-tight">
                {hasLockedType ? activeCategoryLabel : "Catálogo completo"}
              </h1>

              <p className="mt-1 text-[11px] text-slate-400">
                {hasLockedType
                  ? `Explora toda la colección de ${activeCategoryLabel?.toLowerCase() ?? "productos"} disponibles`
                  : "Encuentra zapatillas, ropa y accesorios originales"}
              </p>
            </div>
          </div>

          {/* Badge derecho */}
          {items && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center shrink-0 min-w-[80px]">
              <span className="flex items-center gap-1.5 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/70">En stock</p>
              </span>
              <p className="text-2xl font-extrabold text-white leading-none">{sortedItems.length}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">productos</p>
            </div>
          )}
        </div>
      </div>


      <div className="mx-auto max-w-6xl px-3 sm:px-5 py-4 flex flex-col gap-4">

        {/* ── Barra de filtros ────────────────────────────────── */}
        <div className="flex flex-col gap-3 bg-white rounded-2xl border border-slate-100 shadow-[0_1px_6px_rgba(0,0,0,0.06)] px-4 py-3.5">

          {/* Fila 1: Tipo de producto (si no está bloqueado) */}
          {!hasLockedType && productTypes.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Categoría</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setTypeFilter("")} className={pill(!typeFilter)}>
                  Todos
                </button>
                {productTypes.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTypeFilter(t.key)}
                    className={pill(typeFilter === t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fila 2: Público (si aplica) */}
          {typeFilter && supportsAudienceFilter(typeFilter) && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Público</p>
              <div className="flex flex-wrap gap-1.5">
                {(["todos", "hombre", "mujer", "ninos"] as Audience[]).map((a) => (
                  <button key={a} type="button" onClick={() => setAudienceFilter(a)} className={pill(audienceFilter === a)}>
                    {AUDIENCE_LABEL[a]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Limpiar — solo si hay filtros con tipo activo */}
          {(!hasLockedType && typeFilter) && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter("");
                setAudienceFilter("");
                setSortBy("latest");
              }}
              className="mt-1 inline-flex items-center gap-1 self-start rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-100 transition-colors"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Limpiar filtros
            </button>
          )}
        </div>

        {/* ── Fila resultado: Conteo + Ordenar ──────────────────── */}
        {items && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-slate-600">
              <span className="font-bold text-slate-900">{sortedItems.length}</span>
              {" "}{sortedItems.length === 1 ? "producto" : "productos"}
              {token && <span className="text-slate-400"> · buscando &ldquo;{token}&rdquo;</span>}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {token && (
                <button type="button" onClick={() => setQText("")} className="text-[11px] text-rose-500 hover:underline">
                  ✕ Borrar búsqueda
                </button>
              )}
              {/* Sort dropdown custom */}
              <div ref={sortRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSortOpen((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-[12px] font-medium shadow-sm transition-all duration-150 ${sortOpen
                    ? "border-emerald-400 bg-white text-slate-900 shadow-md"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                >
                  <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M7 12h10M11 17h2" />
                  </svg>
                  {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Ordenar"}
                  <svg
                    className={`h-3 w-3 text-slate-400 shrink-0 transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Panel */}
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[160px] rounded-2xl border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.14)] overflow-hidden">
                    <p className="px-3.5 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                      Ordenar por
                    </p>
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                        className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] transition-colors duration-100 ${sortBy === opt.value
                          ? "bg-emerald-50 text-emerald-700 font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                          }`}
                      >
                        {opt.label}
                        {sortBy === opt.value && (
                          <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


        {/* ── Error ───────────────────────────────────────────── */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* ── Skeleton cargando ────────────────────────────────── */}
        {!items && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="aspect-square skeleton" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 w-4/5 rounded-full skeleton" />
                  <div className="h-3.5 w-1/2 rounded-full skeleton" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Grid de productos ────────────────────────────────── */}
        {items && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {sortedItems.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}

        {/* ── Vacío ───────────────────────────────────────────── */}
        {items && !sortedItems.length && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-base font-bold text-slate-900">Sin resultados</p>
            <p className="text-sm text-slate-500 mt-1 max-w-xs">
              No encontramos productos con ese filtro. Prueba con otra categoría o limpia los filtros.
            </p>
            <button
              type="button"
              onClick={() => { setQText(""); setTypeFilter(""); setAudienceFilter(""); setSortBy("latest"); }}
              className="mt-4 inline-flex h-9 items-center rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
            >
              Ver todo el catálogo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
