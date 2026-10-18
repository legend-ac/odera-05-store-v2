"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, limit, query, startAfter, where, type QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";
import { getSearchTerms, normalizeToken, productMatchesSearch } from "@/lib/searchTokens";
import { hasStock } from "@/lib/productStock";
import styles from "./catalog.module.css";

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
  { value: "name", label: "Nombre: A–Z" },
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
  const terms = useMemo(() => getSearchTerms(qText), [qText]);
  // Firestore can require one indexed token; the remaining terms are ANDed below.
  const token = terms.find((term) => term.length >= 2) ?? "";
  const [typeFilter, setTypeFilter] = useState<string>(routeType.toLowerCase().trim());
  const hasLockedType = Boolean(routeType.trim());
  const [audienceFilter, setAudienceFilter] = useState<Audience | "">(
    (["hombre", "mujer", "ninos", "todos"].includes(routeAudience.toLowerCase())
      ? (routeAudience.toLowerCase() as Audience)
      : "") as Audience | ""
  );
  const [sortBy, setSortBy] = useState<SortType>("latest");
  const [items, setItems] = useState<CatalogItem[] | null>(initialItems ?? []);
  const [error, setError] = useState<string | null>(null);

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
    if (!terms.length) {
      setItems(initialItems ?? []);
      return () => { mounted = false; };
    }
    setItems(null);
    (async () => {
      try {
        const base = collection(db, "products");
        const constraints = [
          where("status", "==", "active"),
          ...(token ? [where("searchTokens", "array-contains", token)] : []),
          limit(50),
        ];
        const candidates: QueryDocumentSnapshot[] = [];
        let cursor: QueryDocumentSnapshot | undefined;
        // Do not truncate the first word's results before testing the full query.
        while (mounted) {
          const snap = await getDocs(query(base, ...constraints, ...(cursor ? [startAfter(cursor)] : [])));
          candidates.push(...snap.docs.filter((d) => productMatchesSearch(d.data(), terms)));
          if (snap.size < 50) break;
          cursor = snap.docs[snap.docs.length - 1];
        }
        const raw = candidates.map((d) => {
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
          if (list.length >= 50) break;
        }
        if (mounted) setItems(list);
      } catch (e) {
        console.error(e);
        if (mounted) setError("No pudimos cargar el catálogo. Intenta nuevamente.");
      }
    })();
    return () => { mounted = false; };
  }, [token, terms, initialItems]);

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

  const resetFilters = () => {
    setQText("");
    setTypeFilter("");
    setAudienceFilter("");
    setSortBy("latest");
  };
  const hasFilters = Boolean(terms.length || typeFilter || audienceFilter && audienceFilter !== "todos");
  const catalogTitle = hasLockedType ? activeCategoryLabel ?? "Catálogo" : "Encuentra tu próximo par.";

  return (
    <div className={styles.catalog}>
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Ruta de navegación">
          <Link href="/">Inicio</Link>
          <span aria-hidden="true">/</span>
          {hasLockedType && <><Link href="/catalog">Catálogo</Link><span aria-hidden="true">/</span></>}
          <span aria-current="page">{hasLockedType ? activeCategoryLabel ?? "Catálogo" : "Catálogo"}</span>
        </nav>

        <header className={styles.heading}>
          <div>
            <span className={styles.eyebrow}>La selección de Odera 05</span>
            <h1>{catalogTitle}</h1>
          </div>
          <p>
            {hasLockedType
              ? `Explora nuestra selección de ${activeCategoryLabel?.toLowerCase() ?? "productos"}.`
              : "Zapatillas, ropa y accesorios originales para tu día a día."}
            <span>Elige tu estilo. Encuentra tu talla.</span>
          </p>
        </header>

        <div className={styles.layout}>
          <aside className={styles.filters} aria-label="Filtros de productos">
            <div className={styles.filterHeading}>
              <span>Filtrar por</span>
              {hasFilters && (hasLockedType
                ? <Link href="/catalog">Ver todo</Link>
                : <button type="button" onClick={resetFilters}>Limpiar</button>)}
            </div>

            {!hasLockedType && productTypes.length > 0 && (
              <fieldset className={styles.filterGroup}>
                <legend>Categoría</legend>
                <div className={styles.categories}>
                  {[{ key: "", label: "Todo el catálogo" }, ...productTypes].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTypeFilter(t.key)}
                      aria-pressed={typeFilter === t.key}
                      className={`${styles.category} ${typeFilter === t.key ? styles.categoryActive : ""}`}
                    >
                      <span>{t.label}</span>
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="m7 4 6 6-6 6" />
                      </svg>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {typeFilter && supportsAudienceFilter(typeFilter) && (
              <fieldset className={styles.filterGroup}>
                <legend>Para quién</legend>
                <div className={styles.audiences}>
                  {(["todos", "hombre", "mujer", "ninos"] as Audience[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAudienceFilter(a)}
                      aria-pressed={audienceFilter === a}
                      className={audienceFilter === a ? styles.audienceActive : ""}
                    >
                      {AUDIENCE_LABEL[a]}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <div className={styles.filterNote}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 3h6l1 4h4v14H4V7h4l1-4Z" /><path d="M8 7h8M9 12v2m6-2v2" />
              </svg>
              <div><strong>Tu talla te espera.</strong><p>Revisa las tallas disponibles en cada producto.</p></div>
            </div>
          </aside>

          <section className={styles.results} aria-label="Productos del catálogo" aria-busy={!items}>
            <div className={styles.toolbar}>
              <div className={styles.resultCount} aria-live="polite">
                {items ? <><strong>{sortedItems.length}</strong> {sortedItems.length === 1 ? "producto" : "productos"}</> : "Cargando productos…"}
                {terms.length > 0 && (
                  <button type="button" className={styles.searchChip} onClick={() => setQText("")} aria-label={`Quitar búsqueda: ${qText.trim()}`}>
                    <span>“{qText.trim()}”</span><span aria-hidden="true">×</span>
                  </button>
                )}
              </div>
              <div className={styles.sort}>
                <label htmlFor="catalog-sort">Ordenar por</label>
                <div className={styles.selectWrap}>
                  <select id="catalog-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortType)}>
                    {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 7 5 5 5-5" /></svg>
                </div>
              </div>
            </div>

            {error && <div className={styles.error} role="alert">{error}</div>}

            {!items && !error && (
              <div className={styles.grid} aria-label="Cargando productos">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div className={styles.skeletonCard} key={i} aria-hidden="true">
                    <div className="aspect-square skeleton" />
                    <div className={styles.skeletonInfo}><div className="h-3 w-4/5 skeleton" /><div className="h-3 w-1/2 skeleton" /></div>
                  </div>
                ))}
              </div>
            )}

            {items && sortedItems.length > 0 && (
              <div className={styles.grid}>
                {sortedItems.map((p, index) => <ProductCard key={p.id} p={p} priority={index < 8} />)}
              </div>
            )}

            {items && !sortedItems.length && (
              <div className={styles.empty}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
                <h2>No encontramos resultados.</h2>
                <p>Prueba otra categoría o elimina los filtros para explorar la selección completa.</p>
                {hasLockedType
                  ? <Link href="/catalog" className={styles.reset}>Ver todo el catálogo <span aria-hidden="true">→</span></Link>
                  : <button type="button" onClick={resetFilters} className={styles.reset}>Ver todo el catálogo <span aria-hidden="true">→</span></button>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
