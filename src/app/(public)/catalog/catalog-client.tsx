"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";
import { normalizeToken } from "@/lib/searchTokens";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/fields";
import { hasStock } from "@/lib/productStock";

type SortType = "latest" | "price-asc" | "price-desc" | "name";
type Audience = "hombre" | "mujer" | "ninos" | "todos";
type CatalogItem = ProductCardData & { productType?: string; audience?: Audience };

const AUDIENCE_LABEL: Record<Audience, string> = {
  hombre: "Hombre",
  mujer: "Mujer",
  ninos: "Ninos",
  todos: "Todos",
};

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
  initialItems,
  initialQuery,
  initialType,
  initialAudience,
  productTypes,
}: {
  initialItems: CatalogItem[];
  initialQuery: string;
  initialType: string;
  initialAudience: string;
  productTypes: { key: string; label: string }[];
}) {
  const [qText, setQText] = useState(initialQuery ?? "");
  const token = useMemo(() => normalizeToken(qText).split(/\s+/g).filter(Boolean)[0] ?? "", [qText]);
  const [typeFilter, setTypeFilter] = useState<string>((initialType ?? "").toLowerCase().trim());
  const hasLockedType = Boolean((initialType ?? "").trim());
  const [audienceFilter, setAudienceFilter] = useState<Audience | "">(
    (["hombre", "mujer", "ninos", "todos"].includes((initialAudience ?? "").toLowerCase())
      ? (initialAudience.toLowerCase() as Audience)
      : "") as Audience | ""
  );
  const [sortBy, setSortBy] = useState<SortType>("latest");
  const [items, setItems] = useState<CatalogItem[] | null>(initialItems ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQText(initialQuery ?? "");
  }, [initialQuery]);

  useEffect(() => {
    setTypeFilter((initialType ?? "").toLowerCase().trim());
  }, [initialType]);

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
      return () => {
        mounted = false;
      };
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
            id: d.id,
            name: String(data.name ?? ""),
            price: Number(data.price ?? 0),
            salePrice: typeof data.salePrice === "number" ? data.salePrice : undefined,
            onSale: Boolean(data.onSale),
            imageUrl: typeof mainUrl === "string" ? mainUrl : undefined,
            imageUrls,
            productType: String(data?.productType ?? "").trim() || undefined,
            audience: normalizeAudience(data?.audience),
            hasStock: hasStock(variants),
            dedupeKey,
            updatedAtMs,
          };
        });

        const byLatest = raw.filter((x: any) => x.hasStock).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        const seen = new Set<string>();
        const list: CatalogItem[] = [];
        for (const it of byLatest) {
          if (seen.has(it.dedupeKey)) continue;
          seen.add(it.dedupeKey);
          list.push({
            id: it.id,
            name: it.name,
            price: it.price,
            salePrice: it.salePrice,
            onSale: it.onSale,
            imageUrl: it.imageUrl,
            imageUrls: it.imageUrls,
            productType: it.productType,
            audience: it.audience,
          });
        }

        if (mounted) setItems(list);
      } catch (e) {
        console.error(e);
        if (mounted) setError("No pudimos cargar el catalogo. Intenta nuevamente en unos segundos.");
      }
    })();

    return () => {
      mounted = false;
    };
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
    if (sortBy === "price-asc") {
      return list.sort((a, b) => {
        const pa = a.onSale && typeof a.salePrice === "number" ? a.salePrice : a.price;
        const pb = b.onSale && typeof b.salePrice === "number" ? b.salePrice : b.price;
        return pa - pb;
      });
    }
    if (sortBy === "price-desc") {
      return list.sort((a, b) => {
        const pa = a.onSale && typeof a.salePrice === "number" ? a.salePrice : a.price;
        const pb = b.onSale && typeof b.salePrice === "number" ? b.salePrice : b.price;
        return pb - pa;
      });
    }
    return list;
  }, [items, sortBy, typeFilter, audienceFilter]);

  useEffect(() => {
    if (!typeFilter || !supportsAudienceFilter(typeFilter)) {
      setAudienceFilter("");
    } else if (!audienceFilter) {
      setAudienceFilter("todos");
    }
  }, [typeFilter, audienceFilter]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Catalogo</h1>
        <p className="text-sm text-slate-600">Encuentra productos por nombre, marca o tipo desde el buscador superior.</p>
      </div>

      <Card className="rounded-2xl border-slate-200 panel-soft-hover">
        <CardBody className="flex flex-col gap-3 md:gap-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2 min-w-0">
              {!hasLockedType ? (
                <label className="grid gap-1 text-xs text-slate-600 md:max-w-[220px]">
                  Tipo
                  <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="">Todos los tipos</option>
                    {productTypes.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}
              {typeFilter && supportsAudienceFilter(typeFilter) ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 pr-1">Publico</span>
                  {(["todos", "hombre", "mujer", "ninos"] as Audience[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAudienceFilter(a)}
                      className={[
                        "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                        audienceFilter === a
                          ? "border-[var(--brand-500)] bg-[var(--brand-100)] text-[var(--brand-700)]"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {AUDIENCE_LABEL[a]}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-end md:shrink-0">
              <label className="grid gap-1 text-xs text-slate-600 md:w-[220px]">
                Orden
                <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortType)}>
                  <option value="latest">Mas recientes</option>
                  <option value="price-asc">Precio: menor a mayor</option>
                  <option value="price-desc">Precio: mayor a menor</option>
                  <option value="name">Nombre A-Z</option>
                </Select>
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!hasLockedType) setTypeFilter("");
                  setAudienceFilter(typeFilter && supportsAudienceFilter(typeFilter) ? "todos" : "");
                  setSortBy("latest");
                }}
                className="!min-h-10 md:mb-[1px]"
              >
                Limpiar
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {items ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {sortedItems.length} {sortedItems.length === 1 ? "producto encontrado" : "productos encontrados"}
          </p>
          {token ? <BadgeToken token={token} /> : null}
        </div>
      ) : null}

      {error ? (
        <Card className="rounded-2xl border-rose-200 bg-rose-50">
          <CardBody className="text-sm text-rose-700">{error}</CardBody>
        </Card>
      ) : null}

      {!items ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="aspect-[4/5] skeleton" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-4/5 rounded skeleton" />
                <div className="h-4 w-1/2 rounded skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {items && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedItems.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}

      {items && !items.length ? (
        <Card className="rounded-2xl border-slate-200">
          <CardBody className="py-10 text-center">
            <p className="text-base font-semibold text-slate-900">No encontramos productos con esa busqueda</p>
            <p className="text-sm text-slate-600 mt-1">Prueba con otra palabra o limpia el filtro.</p>
            <div className="mt-4">
              <Button type="button" variant="secondary" onClick={() => setQText("")}>
                Ver todo el catalogo
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function BadgeToken({ token }: { token: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
      Busqueda: {token}
    </span>
  );
}
