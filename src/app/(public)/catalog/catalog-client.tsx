"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  { value: "latest", label: "Más recientes" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "name", label: "Nombre A–Z" },
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
  initialItems, productTypes,
}: {
  initialItems: CatalogItem[];
  productTypes: { key: string; label: string }[];
}) {
  const searchParams = useSearchParams();
  const routeQuery = searchParams.get("q") ?? "";
  const routeType = searchParams.get("type") ?? "";
  const routeAudience = searchParams.get("audience") ?? "";

  const [qText, setQText] = useState(routeQuery);
  const token = useMemo(
    () => normalizeToken(qText).split(/\s+/g).filter(Boolean)[0] ?? "",
    [qText]
  );
  const [typeFilter, setTypeFilter] = useState<string>(routeType.toLowerCase().trim());
  const hasLockedType = Boolean(routeType.trim());
  const [audienceFilter, setAudienceFilter] = useState<Audience | "">(
    (["hombre", "mujer", "ninos", "todos"].includes(routeAudience.toLowerCase())
      ? (routeAudience.toLowerCase() as Audience)
      : "") as Audience | ""
  );
  const [sortBy, setSortBy] = useState<SortType>("latest");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<CatalogItem[] | null>(initialItems ?? []);
  const [error, setError] = useState<string | null>(null);

  // Cierra el dropdown al hacer click fuera
  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortOpen]);

  useEffect(() => { setQText(routeQuery); }, [routeQuery]);
  useEffect(() => { setTypeFilter(routeType.toLowerCase().trim()); }, [routeType]);
  useEffect(() => {
    const normalizedAudience =
      ["hombre", "mujer", "ninos", "todos"].includes(routeAudience.toLowerCase())
        ? (routeAudience.toLowerCase() as Audience)
        : "";
    setAudienceFilter(normalizedAudience);
  }, [routeAudience]);

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

  const activeCategoryLabel = productTypes.find(
    (t) => t.key.toLowerCase() === typeFilter.toLowerCase()
  )?.label ?? null;

  return (
    <div className="min-h-screen bg-white">

      {/* ── Banner del catálogo ── */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex items-center justify-between gap-4">

            {/* Izquierda: título */}
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 mb-2">
                <a href="/" className="text-[11px] text-zinc-500 hover:text-zinc-950 transition-colors">Inicio</a>
                <svg className="h-2.5 w-2.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                <span className="text-[11px] font-semibold text-zinc-700">
                  {hasLockedType ? activeCategoryLabel : "Catálogo"}
                </span>
              </div>

              <h1 className="text-3xl font-display font-bold text-zinc-950 leading-tight tracking-tight sm:text-4xl">
                {hasLockedType ? activeCategoryLabel : "Catálogo"}
              </h1>
              <p className="mt-2 text-[13px] text-zinc-500 max-w-sm">
                {hasLockedType
                  ? `Explora todos los ${activeCategoryLabel?.toLowerCase() ?? "productos"} disponibles · Stock actualizado`
                  : "Zapatillas, ropa y accesorios originales · Stock actualizado"}
              </p>
            </div>

            {/* Derecha: contador */}
            {items && (
              <div className="shrink-0 border-l border-zinc-200 pl-5 text-right">
                <span className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Disponibles
                </span>
                <p className="mt-1 text-3xl font-bold leading-none tabular-nums text-zinc-950">{sortedItems.length}</p>
                <p className="mt-1 text-[10px] text-zinc-500">productos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Contenido principal ── */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">

        {/* Barra de filtros pegada al banner */}
        <div className="border-b border-zinc-200 py-5">

          <div className="flex flex-col gap-3">
            {/* Categorías */}
            {!hasLockedType && productTypes.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Categoría</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTypeFilter("")}
                    className={`border-b-2 px-1 py-1.5 text-[12px] font-medium transition-colors duration-150 cursor-pointer ${!typeFilter
                      ? "border-zinc-950 text-zinc-950 font-semibold"
                      : "border-transparent bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-950"
                      }`}
                  >
                    Todos
                  </button>
                  {productTypes.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTypeFilter(t.key)}
                      className={`border-b-2 px-1 py-1.5 text-[12px] font-medium transition-colors duration-150 cursor-pointer ${typeFilter === t.key
                        ? "border-zinc-950 text-zinc-950 font-semibold"
                        : "border-transparent bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-950"
                        }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Público (si aplica) */}
            {typeFilter && supportsAudienceFilter(typeFilter) && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Para</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["todos", "hombre", "mujer", "ninos"] as Audience[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAudienceFilter(a)}
                      className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-150 cursor-pointer ${audienceFilter === a
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                        }`}
                    >
                      {AUDIENCE_LABEL[a]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Limpiar filtros */}
            {(!hasLockedType && typeFilter) && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Filtrando: <strong className="text-slate-700">{activeCategoryLabel}</strong>
                  {audienceFilter && audienceFilter !== "todos" && (
                    <> · <strong className="text-slate-700">{AUDIENCE_LABEL[audienceFilter as Audience]}</strong></>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => { setTypeFilter(""); setAudienceFilter(""); setSortBy("latest"); }}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Limpiar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fila: conteo + ordenar */}
        <div className="flex items-center justify-between gap-3 mt-3 mb-3">
          {items ? (
            <p className="text-[13px] text-slate-500">
              <span className="font-bold text-slate-900">{sortedItems.length}</span>{" "}
              {sortedItems.length === 1 ? "producto" : "productos"}
              {token && (
                <span className="text-slate-400"> · &ldquo;{token}&rdquo;
                  <button type="button" onClick={() => setQText("")} className="ml-1.5 text-[11px] text-rose-500 hover:underline font-medium">✕ borrar</button>
                </span>
              )}
            </p>
          ) : (
            <p className="text-[13px] text-slate-400">Cargando...</p>
          )}

          {/* Sort dropdown */}
          <div ref={sortRef} className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[12px] font-medium shadow-sm transition-all duration-150 ${sortOpen
                ? "border-emerald-400 bg-white text-slate-900 shadow-md"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
            >
              <svg className="h-3.5 w-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M7 12h10M11 17h2" />
              </svg>
              <span className="hidden sm:inline">{SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Ordenar"}</span>
              <span className="sm:hidden">Ordenar</span>
              <svg
                className={`h-3 w-3 text-slate-400 shrink-0 transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {sortOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[200px] rounded-2xl border border-slate-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.14)] overflow-hidden">
                <p className="px-4 py-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  Ordenar por
                </p>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] transition-colors duration-100 ${sortBy === opt.value
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

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-4">
            {error}
          </div>
        )}

        {/* Skeleton cargando */}
        {!items && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="aspect-square skeleton" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-4/5 rounded-full skeleton" />
                  <div className="h-3 w-1/2 rounded-full skeleton" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid de productos */}
        {items && sortedItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 pb-10">
            {sortedItems.map((p, index) => (
              <ProductCard key={p.id} p={p} priority={index < 8} />
            ))}
          </div>
        )}

        {/* Estado vacío */}
        {items && !sortedItems.length && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center mb-10">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-base font-bold text-slate-900">Sin resultados</p>
            <p className="text-sm text-slate-500 mt-1.5 max-w-xs">
              No encontramos productos con ese filtro. Prueba cambiando la categoría o limpiando los filtros.
            </p>
            <button
              type="button"
              onClick={() => { setQText(""); setTypeFilter(""); setAudienceFilter(""); setSortBy("latest"); }}
              className="mt-5 inline-flex h-9 items-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Ver todo el catálogo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
