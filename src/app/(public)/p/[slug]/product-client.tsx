"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCart } from "@/components/cart/CartProvider";
import { formatPEN } from "@/lib/money";
import type { ProductCardData } from "@/components/ProductCard";
import ProductCard from "@/components/ProductCard";

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
        const list = snap.docs.filter((d) => d.id !== slug).slice(0, 4).map((d) => {
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
          Cargando producto...
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/catalog" className="text-sm text-[var(--brand-600)] font-semibold hover:underline">Volver al catálogo</Link>
      </div>
    );
  }
  if (!data) return null;

  return (
    <>
      <div className="text-slate-900">

        {/* Breadcrumb */}
        <div className="mx-auto max-w-6xl px-4 pt-5 pb-3 sm:px-6">
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">Inicio</Link>
            <span className="text-slate-300">›</span>
            <Link href="/catalog" className="hover:text-slate-900 transition-colors">Catálogo</Link>
            <span className="text-slate-300">›</span>
            <span className="text-slate-900 truncate max-w-[200px]">{String(data.name ?? "")}</span>
          </nav>
        </div>

        {/* Layout principal */}
        <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-4 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">

          {/* GALERÍA */}
          <div className="flex flex-col gap-4 lg:gap-5 lg:sticky lg:top-24">
            {/* Imagen principal */}
            <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-[var(--shadow-card)]">
              {hasDiscount && (
                <div className="absolute left-3 top-3 z-10 flex gap-1.5">
                  <span className="rounded-full bg-[var(--sale)] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
                    Oferta
                  </span>
                  <span className="rounded-full bg-black/70 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-bold text-white">
                    -{discountPct}%
                  </span>
                </div>
              )}

              <div className="relative flex items-center justify-center overflow-hidden w-full mx-auto h-[320px] sm:h-[400px] lg:h-[420px]">
                {mainImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mainImg}
                    alt={data.name ?? ""}
                    className="h-full w-full object-contain p-4 sm:p-8 transition-transform duration-700 group-hover:scale-[1.03]"
                    onError={() => setImgIndex((i) => (i + 1 < galleryUrls.length ? i + 1 : i))}
                  />
                ) : (
                  <div className="text-xs text-slate-400">Sin foto</div>
                )}
              </div>

              {/* Gallery controls */}
              {galleryUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Imagen anterior"
                    onClick={() => setImgIndex((i) => (i - 1 + galleryUrls.length) % galleryUrls.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-slate-200 text-slate-900 hover:bg-white transition-all duration-200"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Siguiente imagen"
                    onClick={() => setImgIndex((i) => (i + 1) % galleryUrls.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-slate-200 text-slate-900 hover:bg-white transition-all duration-200"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>

                  {/* Mobile dots */}
                  <div className="absolute bottom-4 left-0 right-0 lg:hidden flex justify-center gap-1.5 z-10">
                    {galleryUrls.map((_, i) => (
                      <span
                        key={i}
                        className={`block h-1.5 rounded-full transition-all duration-300 ${i === imgIndex ? "w-4 bg-slate-900" : "w-1.5 bg-slate-400/50"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {galleryUrls.length > 1 && (
              <div className="hidden lg:flex gap-3 overflow-x-auto pb-2 scrollbar-hide justify-center">
                {galleryUrls.slice(0, 8).map((url, i) => (
                  <button
                    key={`${url}-desktop-${i}`}
                    type="button"
                    onClick={() => setImgIndex(i)}
                    className={`shrink-0 h-[70px] w-[70px] overflow-hidden rounded-xl border-2 transition-all duration-300 ${i === imgIndex
                      ? "border-slate-900 opacity-100 ring-2 ring-slate-900/10 ring-offset-2"
                      : "border-slate-200 opacity-60 hover:opacity-100 hover:border-slate-300 bg-white"
                      }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`${data.name ?? ""} ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PANEL DE INFO */}
          <div className="mt-8 flex flex-col gap-6 lg:mt-0 lg:py-4">

            {/* Brand + Name */}
            <div>
              {data.brand && (
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--brand-600)] mb-2">
                  {String(data.brand)}
                </p>
              )}
              <h1 className="text-[28px] sm:text-[34px] font-display font-bold leading-[1.1] text-slate-900 tracking-tight">
                {String(data.name ?? "")}
              </h1>
            </div>

            {/* Price */}
            <div className="flex items-end gap-3 pb-5 border-b border-slate-200">
              <span className="text-[32px] sm:text-[38px] font-black text-slate-900 leading-none tabular-nums">
                {formatPEN(unitPrice)}
              </span>
              {hasDiscount && (
                <div className="flex flex-col mb-1.5 gap-0.5">
                  <span className="text-sm font-medium text-slate-400 line-through leading-none tabular-nums">
                    {formatPEN(data.price)}
                  </span>
                </div>
              )}
            </div>

            {/* Specs */}
            {specsText && (
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowSpecs((v) => !v)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-900">Especificaciones</span>
                  <svg
                    className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${showSpecs ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showSpecs && (
                  <div className="border-t border-slate-200 px-5 pb-5 pt-4">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{specsText}</p>
                  </div>
                )}
              </div>
            )}

            {/* Variants */}
            {variants.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-900">
                    {variants[0]?.size ? "Talla" : variants[0]?.color ? "Color" : "Opciones"}
                  </p>
                  {selectedVariant && (
                    <p className="text-xs font-semibold">
                      {selectedVariant.stock > 0
                        ? <span className="text-emerald-700">Stock: {selectedVariant.stock}</span>
                        : <span className="text-destructive">Agotado</span>
                      }
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {variants.map((v) => {
                    const label = v.size ? `${v.size}` : v.color ? v.color : v.id;
                    const active = v.id === variantId;
                    const outOfStock = v.stock <= 0;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => setVariantId(v.id)}
                        className={`relative rounded-xl px-4 py-2.5 text-sm font-bold border-2 transition-all duration-200 min-w-[3.5rem] ${outOfStock
                          ? "bg-white border-slate-200 text-slate-300 line-through cursor-not-allowed"
                          : active
                            ? "bg-slate-900 border-slate-900 text-white shadow-md"
                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:text-slate-900"
                          }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Qty + CTA */}
            <div className="flex flex-col gap-5 mt-2">
              <div className="flex items-center gap-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-900 flex-1">Cantidad</p>
                <div className="inline-flex items-center rounded-xl border-2 border-slate-200 bg-white overflow-hidden h-12 w-32">
                  <button
                    type="button"
                    title="Reducir"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex-1 h-full flex items-center justify-center text-xl font-medium text-slate-500 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    −
                  </button>
                  <span className="h-8 min-w-[32px] flex items-center justify-center border-x-2 border-slate-200 text-sm font-bold text-slate-900 tabular-nums">
                    {Math.min(50, Math.max(1, Math.floor(qty || 1)))}
                  </span>
                  <button
                    type="button"
                    title="Aumentar"
                    onClick={() => setQty((q) => Math.min(Math.min(50, Math.max(1, available)), q + 1))}
                    className="flex-1 h-full flex items-center justify-center text-xl font-medium text-slate-500 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={!variantId || available <= 0}
                onClick={() => {
                  const safeQty = Math.min(50, Math.max(1, Math.floor(qty || 1)));
                  addItem({ productId: data.id, variantId, qty: safeQty });
                  setAddedQty(safeQty);
                  setShowCartModal(true);
                }}
                className="btn-brand w-full h-14 text-[15px] tracking-wider uppercase disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {available <= 0 ? "Agotado" : "Añadir al carrito"}
              </button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              {[
                { e: "🔒", t: "Compra segura", d: "Pago verificado" },
                { e: "📦", t: "Envíos directos", d: "Seguimiento real" },
                { e: "✅", t: "100% Original", d: "Calidad garantizada" },
                { e: "💬", t: "Atención al cliente", d: "Soporte WhatsApp" },
              ].map(b => (
                <div key={b.t} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm hover:shadow-[var(--shadow-card)] transition-shadow duration-200">
                  <span className="text-lg opacity-80 shrink-0">{b.e}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-900 truncate">{b.t}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">{b.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recommended */}
        {recommended.length > 0 && (
          <div className="mx-auto max-w-[1100px] px-4 pb-16 sm:px-6">
            <h2 className="text-lg font-display font-bold text-slate-900 mb-4">También te puede gustar</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recommended.map((it) => (
                <ProductCard key={it.id} p={it} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CART MODAL */}
      {showCartModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-sm p-3 sm:items-center sm:p-6">
          <div className="w-full max-w-[440px] fade-in-up">
            <div className="max-h-[85dvh] overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-[var(--shadow-elevated)] flex flex-col">
              {/* Modal Header */}
              <div className="flex-shrink-0 flex items-start justify-between gap-4 p-5 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-1 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Añadido con éxito
                  </p>
                  <h2 className="text-xl font-bold text-slate-900">Continúa tu compra</h2>
                </div>
                <button
                  type="button"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
                  onClick={() => setShowCartModal(false)}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 bg-[var(--surface-muted)]">
                <div className="flex gap-3.5 rounded-xl bg-white border border-slate-200 p-3.5 shadow-sm">
                  <div className="h-18 w-18 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-muted)] border border-slate-200">
                    {mainImg && <img src={mainImg} alt={String(data.name ?? "")} className="h-full w-full object-contain p-1" />}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight">{String(data.name ?? "")}</p>
                    <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-600">
                        {selectedVariant?.size ? `${selectedVariant.size}` : selectedVariant?.color ?? ""}
                      </span>
                      <span className="opacity-40">•</span>
                      <span>{addedQty} un.</span>
                    </p>
                  </div>
                  <div className="flex items-center pl-2">
                    <p className="text-base font-black text-slate-900 tabular-nums">{formatPEN(modalSubtotal)}</p>
                  </div>
                </div>

                {recommended.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 mb-3">Sugerencias para ti</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {recommended.slice(0, 3).map((it) => {
                        const price = it.onSale && typeof it.salePrice === "number" ? it.salePrice : it.price;
                        const img = it.imageUrl || it.imageUrls?.[0] || "";
                        return (
                          <Link
                            key={it.id}
                            href={`/p/${it.id}`}
                            className="w-[120px] shrink-0 rounded-xl bg-white border border-slate-200 p-2 hover:border-slate-300 hover:shadow-[var(--shadow-card)] transition-all duration-300 group"
                          >
                            <div className="aspect-square overflow-hidden rounded-lg bg-[var(--surface-muted)] mb-2">
                              {img && <img src={img} alt={it.name} className="h-full w-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-500" />}
                            </div>
                            <p className="line-clamp-2 text-[11px] font-bold text-slate-600 leading-tight mb-1 group-hover:text-slate-900">{it.name}</p>
                            <p className="text-xs font-black text-slate-900 tabular-nums">{formatPEN(price)}</p>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex-shrink-0 flex flex-col gap-2.5 p-5 border-t border-slate-100 bg-white">
                <Link
                  href="/cart"
                  className="btn-brand w-full justify-center h-12 text-sm"
                >
                  Ver mi carrito
                </Link>
                <button
                  type="button"
                  onClick={() => setShowCartModal(false)}
                  className="w-full h-12 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-[var(--surface-hover)] hover:border-slate-300 transition-all"
                >
                  Seguir viendo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
