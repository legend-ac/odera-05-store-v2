"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCart } from "@/components/cart/CartProvider";
import { formatPEN } from "@/lib/money";
import type { ProductCardData } from "@/components/ProductCard";

type Variant = { id: string; size?: string; color?: string; sku?: string; stock: number };
type Img = { url: string; alt?: string; isMain: boolean; order: number };

export default function ProductClient({
  slug,
  initialProduct = null,
  initialRecommended = [],
}: {
  slug: string;
  initialProduct?: any | null;
  initialRecommended?: ProductCardData[];
}) {
  const { addItem } = useCart();
  const [loading, setLoading] = useState(!initialProduct);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(initialProduct);

  const [variantId, setVariantId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [imgIndex, setImgIndex] = useState(0);
  const [showSpecs, setShowSpecs] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [addedQty, setAddedQty] = useState(1);
  const [recommended, setRecommended] = useState<ProductCardData[]>(initialRecommended);

  useEffect(() => {
    let mounted = true;
    if (initialProduct) {
      setLoading(false);
      const variants = Array.isArray(initialProduct.variants) ? (initialProduct.variants as Variant[]) : [];
      if (variants[0]?.id) setVariantId(String(variants[0].id));
      return () => { mounted = false; };
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const snap = await getDoc(doc(db, "products", slug));
        if (!snap.exists()) { if (mounted) setError("Producto no disponible."); return; }
        const d = snap.data();
        if (mounted) setData({ id: snap.id, ...d });
        const variants = Array.isArray(d.variants) ? (d.variants as Variant[]) : [];
        if (variants[0]?.id && mounted) setVariantId(String(variants[0].id));
      } catch (e) {
        console.error(e);
        if (mounted) setError("No pudimos cargar este producto.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug, initialProduct]);

  useEffect(() => {
    let mounted = true;
    if (initialRecommended?.length) return () => { mounted = false; };
    (async () => {
      try {
        const q = query(collection(db, "products"), where("status", "==", "active"), limit(20));
        const snap = await getDocs(q);
        if (!mounted) return;
        const list = snap.docs.filter((d) => d.id !== slug).slice(0, 3).map((d) => {
          const product = d.data() as any;
          const imgs = Array.isArray(product.images) ? [...product.images] : [];
          const sorted = imgs.sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
          const imageUrls = sorted.map((x: any) => String(x?.url ?? "")).filter(Boolean);
          const mainUrl = sorted.find((x: any) => x?.isMain)?.url ?? imageUrls[0];
          return { id: d.id, name: String(product.name ?? ""), price: Number(product.price ?? 0), salePrice: typeof product.salePrice === "number" ? product.salePrice : undefined, onSale: Boolean(product.onSale), imageUrl: typeof mainUrl === "string" ? mainUrl : undefined, imageUrls } satisfies ProductCardData;
        });
        setRecommended(list);
      } catch { setRecommended([]); }
    })();
    return () => { mounted = false; };
  }, [slug, initialRecommended]);

  const variants: Variant[] = useMemo(() => (data?.variants && Array.isArray(data.variants) ? (data.variants as Variant[]) : []), [data]);
  const images: Img[] = useMemo(() => (data?.images && Array.isArray(data.images) ? (data.images as Img[]) : []), [data]);
  const selectedVariant = useMemo(() => variants.find((v) => v.id === variantId) ?? null, [variants, variantId]);
  const specsText = useMemo(() => String(data?.description ?? "").trim(), [data?.description]);

  const hasDiscount = Boolean(data?.onSale) && typeof data?.salePrice === "number";
  const unitPrice = useMemo(() => {
    if (!data) return 0;
    return (Boolean(data.onSale) && typeof data.salePrice === "number") ? data.salePrice : Number(data.price ?? 0);
  }, [data]);
  const discountPct = hasDiscount && data?.price > 0
    ? Math.round(((data.price - data.salePrice) / data.price) * 100)
    : 0;

  const galleryUrls = useMemo(() => {
    const sorted = [...images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const urls = sorted.map((x) => x.url).filter(Boolean);
    if (!urls.length) return [];
    const main = sorted.find((x) => x.isMain)?.url;
    if (!main) return urls;
    const i = urls.indexOf(main);
    if (i <= 0) return urls;
    return [main, ...urls.slice(0, i), ...urls.slice(i + 1)];
  }, [images]);

  useEffect(() => { setImgIndex(0); }, [slug, galleryUrls.length]);

  const mainImg = galleryUrls[imgIndex] ?? "";
  const available = selectedVariant ? selectedVariant.stock : 0;
  const modalSubtotal = useMemo(() => unitPrice * addedQty, [unitPrice, addedQty]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500 animate-pulse">Cargando producto...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-rose-600">{error}</p>
        <Link href="/catalog" className="text-sm text-emerald-600 underline">Volver al catálogo</Link>
      </div>
    );
  }
  if (!data) return null;

  return (
    <>
      <div className="min-h-screen bg-slate-50">

        {/* ── Breadcrumb ──────────────────────────────────── */}
        <div className="mx-auto max-w-6xl px-4 pt-4 pb-2 sm:px-6">
          <nav className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Link href="/" className="hover:text-slate-800 transition-colors">Inicio</Link>
            <svg className="h-2.5 w-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            <Link href="/catalog" className="hover:text-slate-800 transition-colors">Catálogo</Link>
            <svg className="h-2.5 w-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            <span className="text-slate-700 font-medium truncate max-w-[180px]">{String(data.name ?? "")}</span>
          </nav>
        </div>

        {/* ── Layout principal ─────────────────────────────── */}
        <div className="mx-auto max-w-6xl px-3 pb-10 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 lg:items-start">

          {/* ════ GALERÍA ════════════════════════════════════ */}
          <div className="flex flex-col gap-3">
            {/* Imagen principal */}
            <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
              {hasDiscount && (
                <div className="absolute left-3 top-3 z-10 flex gap-1.5">
                  <span className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                    Oferta
                  </span>
                  <span className="rounded-full bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-white">
                    -{discountPct}%
                  </span>
                </div>
              )}

              <div className="relative flex aspect-square items-center justify-center overflow-hidden sm:aspect-[4/3] lg:aspect-square">
                {mainImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mainImg}
                    alt={data.name ?? ""}
                    className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                    onError={() => setImgIndex((i) => (i + 1 < galleryUrls.length ? i + 1 : i))}
                  />
                ) : (
                  <div className="text-xs text-slate-400">Sin foto</div>
                )}
              </div>

              {/* Controles galería */}
              {galleryUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Imagen anterior"
                    onClick={() => setImgIndex((i) => (i - 1 + galleryUrls.length) % galleryUrls.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 shadow-sm hover:bg-white hover:shadow-md transition-all duration-150"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Siguiente imagen"
                    onClick={() => setImgIndex((i) => (i + 1) % galleryUrls.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-700 shadow-sm hover:bg-white hover:shadow-md transition-all duration-150"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {galleryUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galleryUrls.slice(0, 8).map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={() => setImgIndex(i)}
                    className={`shrink-0 h-16 w-16 overflow-hidden rounded-xl border-2 transition-all duration-150 ${i === imgIndex
                        ? "border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                        : "border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100"
                      }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`${data.name ?? ""} ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ════ PANEL DE INFO ══════════════════════════════ */}
          <div className="mt-4 flex flex-col gap-5 lg:mt-0 lg:sticky lg:top-24">

            {/* Nombre y marca */}
            <div>
              {data.brand && (
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600 mb-1">
                  {String(data.brand)}
                </p>
              )}
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold leading-tight text-slate-900">
                {String(data.name ?? "")}
              </h1>
            </div>

            {/* Precio */}
            <div className="flex items-end gap-3 pb-1 border-b border-slate-200">
              <span className="text-3xl font-extrabold text-slate-900 leading-none">
                {formatPEN(unitPrice)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-base text-slate-400 line-through pb-0.5">
                    {formatPEN(data.price)}
                  </span>
                  <span className="rounded-lg bg-rose-100 px-2 py-0.5 text-[12px] font-bold text-rose-600">
                    -{discountPct}% OFF
                  </span>
                </>
              )}
            </div>

            {/* Especificaciones */}
            {specsText && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSpecs((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-900">Descripción / Especificaciones</span>
                  <svg
                    className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${showSpecs ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showSpecs && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{specsText}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tallas / Variantes como pills */}
            {variants.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-sm font-bold text-slate-900">
                    {variants[0]?.size ? "Talla" : variants[0]?.color ? "Color" : "Variante"}
                  </p>
                  {selectedVariant && (
                    <p className="text-[11px] text-slate-500">
                      {selectedVariant.stock > 0
                        ? <span className="text-emerald-600 font-semibold">✓ {selectedVariant.stock} disponibles</span>
                        : <span className="text-rose-500">Sin stock</span>
                      }
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => {
                    const label = v.size ? `Talla ${v.size}` : v.color ? v.color : v.id;
                    const active = v.id === variantId;
                    const outOfStock = v.stock <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => setVariantId(v.id)}
                        className={`relative rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-all duration-150 ${outOfStock
                            ? "border-slate-200 text-slate-300 cursor-not-allowed line-through"
                            : active
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:text-slate-900"
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cantidad + CTA */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-slate-900">Cantidad</p>
                {/* Stepper +/- */}
                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <button
                    type="button"
                    aria-label="Menos"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="h-10 w-10 flex items-center justify-center text-lg text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    −
                  </button>
                  <span className="h-10 min-w-[44px] flex items-center justify-center border-x border-slate-200 text-sm font-bold text-slate-900">
                    {Math.min(50, Math.max(1, Math.floor(qty || 1)))}
                  </span>
                  <button
                    type="button"
                    aria-label="Más"
                    onClick={() => setQty((q) => Math.min(Math.min(50, Math.max(1, available)), q + 1))}
                    className="h-10 w-10 flex items-center justify-center text-lg text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Botón principal */}
              <button
                type="button"
                disabled={!variantId || available <= 0}
                onClick={() => {
                  const safeQty = Math.min(50, Math.max(1, Math.floor(qty || 1)));
                  addItem({ productId: data.id, variantId, qty: safeQty });
                  setAddedQty(safeQty);
                  setShowCartModal(true);
                }}
                className="w-full h-13 rounded-2xl bg-emerald-500 text-base font-bold text-white shadow-[0_4px_20px_rgba(16,185,129,0.35)] hover:bg-emerald-400 hover:shadow-[0_6px_28px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
              >
                {available <= 0 ? "Sin stock disponible" : "Agregar al carrito"}
              </button>

              <p className="text-center text-[11px] text-slate-400">
                La cantidad final se confirma al generar tu pedido.
              </p>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { e: "🔒", t: "Compra protegida", d: "Pago validado por el equipo" },
                { e: "📦", t: "Seguimiento", d: "Estado del pedido en tiempo real" },
                { e: "✅", t: "100% original", d: "Solo marcas verificadas" },
                { e: "💬", t: "Soporte directo", d: "Atención por WhatsApp" },
              ].map(b => (
                <div key={b.t} className="flex items-start gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                  <span className="text-base shrink-0">{b.e}</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{b.t}</p>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{b.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════ MODAL CARRITO ═══════════════════════════════════ */}
      {showCartModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-2.5 sm:items-center sm:p-6">
          <div className="w-full max-w-[420px] sm:max-w-2xl">
            <div className="max-h-[90dvh] overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_rgba(0,0,0,0.3)]">
              <div className="flex min-h-0 flex-col gap-4 p-5">

                {/* Header modal */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-0.5">¡Listo!</p>
                    <h2 className="text-lg font-extrabold text-slate-900">Producto agregado</h2>
                  </div>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 transition-colors"
                    onClick={() => setShowCartModal(false)}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Preview */}
                <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white border border-slate-200">
                    {mainImg && <img src={mainImg} alt={String(data.name ?? "")} className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 line-clamp-1">{String(data.name ?? "")}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedVariant?.size ? `Talla ${selectedVariant.size}` : selectedVariant?.color ?? ""}
                      {" · "}{addedQty} {addedQty === 1 ? "unidad" : "unidades"}
                    </p>
                    <p className="text-base font-extrabold text-slate-900 mt-1">{formatPEN(modalSubtotal)}</p>
                  </div>
                  {/* Qty stepper modal */}
                  <div className="inline-flex flex-col items-center justify-center gap-1">
                    <button type="button" onClick={() => setAddedQty((q) => Math.max(1, q - 1))} className="h-6 w-6 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100">−</button>
                    <span className="text-xs font-bold text-slate-900">{addedQty}</span>
                    <button type="button" onClick={() => setAddedQty((q) => Math.min(50, q + 1))} className="h-6 w-6 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100">+</button>
                  </div>
                </div>

                {/* Recomendados */}
                {recommended.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">También te puede gustar</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3">
                      {recommended.map((it) => {
                        const price = it.onSale && typeof it.salePrice === "number" ? it.salePrice : it.price;
                        const img = it.imageUrl || it.imageUrls?.[0] || "";
                        return (
                          <Link
                            key={it.id}
                            href={`/p/${it.id}`}
                            className="w-[130px] shrink-0 rounded-xl border border-slate-200 bg-white p-2 hover:border-emerald-300 hover:shadow-sm transition-all duration-150 sm:w-auto"
                          >
                            <div className="aspect-square overflow-hidden rounded-lg bg-slate-100">
                              {img && <img src={img} alt={it.name} className="h-full w-full object-cover" />}
                            </div>
                            <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold text-slate-900">{it.name}</p>
                            <p className="mt-0.5 text-[12px] font-extrabold text-slate-900">{formatPEN(price)}</p>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCartModal(false)}
                    className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Seguir comprando
                  </button>
                  <Link
                    href="/cart"
                    className="flex-1 h-11 inline-flex items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-400 shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_20px_rgba(16,185,129,0.45)] transition-all duration-200"
                  >
                    Ir al carrito
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
