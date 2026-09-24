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
    <div style={{ minHeight: "100vh", background: "var(--ink)" }}>

      {/* ── Header del catálogo ── */}
      <div style={{ background: "var(--ink-2)", borderBottom: "1px solid var(--ash-2)" }}>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 mb-2">
                <a
                  href="/"
                  className="transition-colors duration-150 hover:text-[var(--vermeil)]"
                  style={{ fontSize: "11px", color: "var(--ash)", letterSpacing: "0.06em" }}
                >
                  Inicio
                </a>
                <span style={{ color: "var(--ash-2)", fontSize: "11px" }}>›</span>
                <span style={{ fontSize: "11px", color: "var(--paper)", fontWeight: 600 }}>
                  {hasLockedType ? activeCategoryLabel : "Catálogo"}
                </span>
              </div>
              <h1
                className="font-black leading-none"
                style={{
                  fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
                  fontSize: "clamp(28px, 5vw, 40px)",
                  letterSpacing: "0.06em",
                  color: "var(--paper)",
                }}
              >
                {hasLockedType ? activeCategoryLabel : "Catálogo"}
              </h1>
              <p style={{ fontSize: "12px", color: "var(--ash)", marginTop: "4px" }}>
                {hasLockedType
                  ? `${activeCategoryLabel?.toLowerCase() ?? "productos"} · stock actualizado`
                  : "Zapatillas, ropa y accesorios · stock actualizado"}
              </p>
            </div>

            {/* Contador */}
            {items && (
              <div
                className="shrink-0 text-right pl-5"
                style={{ borderLeft: "1px solid var(--ash-2)" }}
              >
                <span
                  className="block font-bold uppercase"
                  style={{ fontSize: "9px", letterSpacing: "0.2em", color: "var(--ash)" }}
                >
                  Disponibles
                </span>
                <p
                  className="font-black tabular-nums mt-1"
                  style={{
                    fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
                    fontSize: "36px",
                    color: "var(--vermeil)",
                    lineHeight: 1,
                    letterSpacing: "0.04em",
                  }}
                >
                  {sortedItems.length}
                </p>
                <p style={{ fontSize: "10px", color: "var(--ash)", marginTop: "2px" }}>productos</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">

        {/* Barra de filtros */}
        <div className="py-4" style={{ borderBottom: "1px solid var(--ash-2)" }}>
          <div className="flex flex-col gap-3">

            {/* Categorías */}
            {!hasLockedType && productTypes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="font-bold uppercase shrink-0"
                  style={{ fontSize: "9px", letterSpacing: "0.2em", color: "var(--ash)" }}
                >
                  Cat:
                </span>
                {[{ key: "", label: "Todos" }, ...productTypes].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTypeFilter(t.key)}
                    className="font-semibold transition-all duration-150 cursor-pointer"
                    style={{
                      fontSize: "12px",
                      letterSpacing: "0.06em",
                      padding: "4px 10px",
                      border: "1px solid",
                      borderRadius: "2px",
                      borderColor: typeFilter === t.key ? "var(--vermeil)" : "var(--ash-2)",
                      background: typeFilter === t.key ? "var(--vermeil)" : "transparent",
                      color: typeFilter === t.key ? "#fff" : "var(--ash)",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Público */}
            {typeFilter && supportsAudienceFilter(typeFilter) && (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="font-bold uppercase shrink-0"
                  style={{ fontSize: "9px", letterSpacing: "0.2em", color: "var(--ash)" }}
                >
                  Para:
                </span>
                {(["todos", "hombre", "mujer", "ninos"] as Audience[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAudienceFilter(a)}
                    className="font-semibold transition-all duration-150 cursor-pointer"
                    style={{
                      fontSize: "12px",
                      letterSpacing: "0.06em",
                      padding: "4px 10px",
                      border: "1px solid",
                      borderRadius: "2px",
                      borderColor: audienceFilter === a ? "var(--vermeil)" : "var(--ash-2)",
                      background: audienceFilter === a ? "var(--vermeil)" : "transparent",
                      color: audienceFilter === a ? "#fff" : "var(--ash)",
                    }}
                  >
                    {AUDIENCE_LABEL[a]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fila: conteo + ordenar */}
        <div className="flex items-center justify-between gap-3 py-3">
          {items ? (
            <p style={{ fontSize: "12px", color: "var(--ash)" }}>
              <span style={{ fontWeight: 700, color: "var(--paper)" }}>{sortedItems.length}</span>{" "}
              {sortedItems.length === 1 ? "producto" : "productos"}
              {token && (
                <span style={{ color: "var(--ash)" }}>
                  {" "}· &ldquo;{token}&rdquo;
                  <button
                    type="button"
                    onClick={() => setQText("")}
                    className="ml-2 hover:underline"
                    style={{ fontSize: "11px", color: "var(--vermeil)", fontWeight: 600 }}
                  >
                    ✕ borrar
                  </button>
                </span>
              )}
              {!hasLockedType && typeFilter && activeCategoryLabel && (
                <button
                  type="button"
                  onClick={() => { setTypeFilter(""); setAudienceFilter(""); setSortBy("latest"); }}
                  className="ml-3 hover:underline"
                  style={{ fontSize: "11px", color: "var(--vermeil)", fontWeight: 600 }}
                >
                  ✕ {activeCategoryLabel}
                </button>
              )}
            </p>
          ) : (
            <p style={{ fontSize: "12px", color: "var(--ash)" }}>Cargando...</p>
          )}

          {/* Sort dropdown */}
          <div ref={sortRef} className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((v) => !v)}
              className="inline-flex items-center gap-2 font-semibold transition-all duration-150"
              style={{
                fontSize: "11px",
                letterSpacing: "0.06em",
                padding: "6px 12px",
                border: "1px solid",
                borderRadius: "2px",
                borderColor: sortOpen ? "var(--vermeil)" : "var(--ash-2)",
                background: "var(--ink-2)",
                color: "var(--paper)",
              }}
            >
              <svg className="h-3 w-3 shrink-0" style={{ color: "var(--ash)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M7 12h10M11 17h2" />
              </svg>
              <span className="hidden sm:inline">{SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Ordenar"}</span>
              <span className="sm:hidden">Ordenar</span>
              <svg
                className={`h-3 w-3 shrink-0 transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`}
                style={{ color: "var(--ash)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {sortOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 z-50 min-w-[160px] overflow-hidden"
                style={{
                  background: "var(--ink-2)",
                  border: "1px solid var(--ash-2)",
                  borderRadius: "2px",
                  boxShadow: "var(--shadow-elevated)",
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 transition-colors duration-100"
                    style={{
                      fontSize: "12px",
                      background: sortBy === opt.value ? "rgba(232,69,44,0.12)" : "transparent",
                      color: sortBy === opt.value ? "var(--vermeil)" : "var(--ash)",
                      fontWeight: sortBy === opt.value ? 700 : 400,
                      borderBottom: "1px solid var(--ash-2)",
                    }}
                  >
                    {opt.label}
                    {sortBy === opt.value && (
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "var(--vermeil)" }}>
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
          <div
            className="px-4 py-3 text-sm mb-4"
            style={{
              background: "rgba(232,69,44,0.1)",
              border: "1px solid var(--vermeil)",
              borderRadius: "2px",
              color: "var(--vermeil)",
            }}
          >
            {error}
          </div>
        )}

        {/* Skeleton cargando */}
        {!items && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: "var(--ink-2)",
                  border: "1px solid var(--ash-2)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div className="aspect-[3/4] skeleton" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-4/5 skeleton" style={{ borderRadius: "2px" }} />
                  <div className="h-3 w-1/2 skeleton" style={{ borderRadius: "2px" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid de productos */}
        {items && sortedItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-12">
            {sortedItems.map((p, index) => (
              <ProductCard key={p.id} p={p} priority={index < 8} />
            ))}
          </div>
        )}

        {/* Estado vacío */}
        {items && !sortedItems.length && (
          <div
            className="flex flex-col items-center justify-center px-6 py-20 text-center mb-12"
            style={{
              background: "var(--ink-2)",
              border: "1px solid var(--ash-2)",
              borderRadius: "2px",
            }}
          >
            <div
              className="mb-5 flex items-center justify-center"
              style={{
                width: 64,
                height: 64,
                background: "var(--ink-3)",
                border: "1px solid var(--ash-2)",
                borderRadius: "2px",
              }}
            >
              <svg className="h-7 w-7" style={{ color: "var(--ash)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p
              className="font-black"
              style={{
                fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
                fontSize: "22px",
                letterSpacing: "0.08em",
                color: "var(--paper)",
              }}
            >
              SIN RESULTADOS
            </p>
            <p style={{ fontSize: "13px", color: "var(--ash)", marginTop: "6px", maxWidth: "280px", lineHeight: 1.6 }}>
              No encontramos productos con ese filtro. Prueba cambiando la categoría.
            </p>
            <button
              type="button"
              onClick={() => { setQText(""); setTypeFilter(""); setAudienceFilter(""); setSortBy("latest"); }}
              className="btn-brand mt-6"
              style={{ fontSize: "12px", padding: "10px 20px" }}
            >
              Ver todo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
