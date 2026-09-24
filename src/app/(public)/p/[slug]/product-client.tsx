"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCart } from "@/components/cart/CartProvider";
import { formatPEN } from "@/lib/money";
import type { ProductCardData } from "@/components/ProductCard";
import ProductCard from "@/components/ProductCard";
import { optimizedProductImage } from "@/lib/image";

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
  const dragStart = useRef<{ x: number; y: number } | null>(null);

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
        const q = query(collection(db, "products"), where("status", "==", "active"), limit(30));
        const snap = await getDocs(q);
        if (!mounted) return;
        const list = snap.docs.filter((d) => d.id !== slug).slice(0, 8).map((d) => {
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
  const mainImgSrc = optimizedProductImage(mainImg, 1200);
  const available = selectedVariant ? selectedVariant.stock : 0;
  const modalSubtotal = useMemo(() => unitPrice * addedQty, [unitPrice, addedQty]);
  const variantLabel = variants[0]?.size ? "Talla" : variants[0]?.color ? "Color" : "Opción";

  function showPreviousImage() {
    setImgIndex((i) => (i - 1 + galleryUrls.length) % galleryUrls.length);
  }

  function showNextImage() {
    setImgIndex((i) => (i + 1) % galleryUrls.length);
  }

  function onGalleryPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (galleryUrls.length <= 1) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onGalleryPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start || galleryUrls.length <= 1) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) showNextImage();
    else showPreviousImage();
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
        <p className="text-sm text-slate-500">Cargando producto...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
          <svg className="h-6 w-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-bold text-slate-900">{error}</p>
          <Link href="/catalog" className="mt-2 inline-block text-sm text-emerald-600 font-semibold hover:underline">
            ← Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <>
      <div className="bg-[#f4f6f9] min-h-screen">

        {/* Breadcrumb */}
        <div className="mx-auto max-w-6xl px-4 pt-4 pb-2 sm:px-6">
          <nav className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500" aria-label="Navegación">
            <Link href="/" className="hover:text-slate-800 transition-colors">Inicio</Link>
            <span className="text-slate-300">›</span>
            <Link href="/catalog" className="hover:text-slate-800 transition-colors">Catálogo</Link>
            <span className="text-slate-300">›</span>
            <span className="text-slate-800 font-semibold truncate max-w-[180px] sm:max-w-none">
              {String(data.name ?? "")}
            </span>
          </nav>
        </div>

        {/* Layout principal */}
        <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:grid lg:grid-cols-[1fr_1fr] lg:gap-12 lg:items-start">

          {/* ══ GALERÍA ══════════════════════════════════════ */}
          <div className="flex flex-col gap-3 lg:sticky lg:top-20">

            {/* Imagen principal */}
            <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
              {/* Badges */}
              {hasDiscount && (
                <div className="absolute left-3 top-3 z-10 flex gap-1.5">
                  <span className="rounded-full bg-[var(--sale)] px-2.5 py-0.5 text-[11px] font-bold text-white shadow">
                    Oferta
                  </span>
                  <span className="rounded-full bg-black/65 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-bold text-white">
                    -{discountPct}%
                  </span>
                </div>
              )}

              <div
                className="relative flex touch-pan-y cursor-grab select-none items-center justify-center overflow-hidden w-full h-[300px] sm:h-[420px] lg:h-[460px] active:cursor-grabbing"
                onPointerDown={onGalleryPointerDown}
                onPointerUp={onGalleryPointerUp}
                onPointerCancel={() => { dragStart.current = null; }}
              >
                {mainImg ? (
                  <Image
                    src={mainImgSrc}
                    alt={data.name ?? ""}
                    fill
                    priority
                    unoptimized
                    draggable={false}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain p-4 sm:p-8 transition-transform duration-700 ease-out hover:scale-[1.04]"
                    onError={() => setImgIndex((i) => (i + 1 < galleryUrls.length ? i + 1 : i))}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-300">
                    <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">Sin imagen</p>
                  </div>
                )}
              </div>

              {/* Flechas de navegación */}
              {galleryUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Imagen anterior"
                    onClick={showPreviousImage}
                    className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/35 text-slate-700 opacity-25 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/80 hover:opacity-90 hover:shadow-md sm:flex"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Siguiente imagen"
                    onClick={showNextImage}
                    className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/35 text-slate-700 opacity-25 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-white/80 hover:opacity-90 hover:shadow-md sm:flex"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Dots — mobile */}
                  <div className="absolute bottom-3 left-0 right-0 lg:hidden flex justify-center gap-1.5 z-10">
                    {galleryUrls.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setImgIndex(i)}
                        className={`block rounded-full transition-all duration-300 ${i === imgIndex ? "w-5 h-1.5 bg-slate-900" : "w-1.5 h-1.5 bg-slate-400/50"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails — visible en todas las pantallas si hay más de 1 imagen */}
            {galleryUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 justify-start">
                {galleryUrls.slice(0, 8).map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={() => setImgIndex(i)}
                    className={`relative shrink-0 h-[64px] w-[64px] sm:h-[72px] sm:w-[72px] overflow-hidden rounded-xl border-2 transition-all duration-200 bg-white ${i === imgIndex
                      ? "border-slate-800 opacity-100 ring-2 ring-slate-800/10 ring-offset-1"
                      : "border-slate-200 opacity-55 hover:opacity-90 hover:border-slate-400"
                      }`}
                  >
                    <Image
                      src={optimizedProductImage(url, 180)}
                      alt={`${data.name ?? ""} vista ${i + 1}`}
                      fill
                      unoptimized
                      draggable={false}
                      sizes="72px"
                      className="object-contain p-1"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ══ PANEL DE INFO ════════════════════════════════ */}
          <div className="mt-6 flex flex-col gap-5 lg:mt-0 lg:py-2">

            {/* Marca + Nombre */}
            <div>
              {data.brand && (
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--brand-600)] mb-2">
                  {String(data.brand)}
                </p>
              )}
              <h1 className="text-[26px] sm:text-[32px] font-display font-bold leading-[1.1] text-slate-900 tracking-tight">
                {String(data.name ?? "")}
              </h1>
            </div>

            {/* Precio */}
            <div className="flex items-end gap-3 pb-4 border-b border-slate-200">
              <span className={`text-[30px] sm:text-[36px] font-black leading-none tabular-nums ${hasDiscount ? "text-[var(--brand-600)]" : "text-slate-900"}`}>
                {formatPEN(unitPrice)}
              </span>
              {hasDiscount && (
                <div className="flex flex-col mb-1 gap-0.5">
                  <span className="text-sm font-medium text-slate-400 line-through leading-none tabular-nums">
                    {formatPEN(data.price)}
                  </span>
                  <span className="text-[11px] font-bold text-[var(--sale)] leading-none">
                    Ahorras {discountPct}%
                  </span>
                </div>
              )}
            </div>

            {/* Especificaciones */}
            {specsText && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSpecs((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="text-[11px] font-bold uppercase tracking-widest text-slate-700">Especificaciones</span>
                  <svg
                    className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${showSpecs ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showSpecs && (
                  <div className="border-t border-slate-200 px-4 pb-4 pt-3 bg-slate-50">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">{specsText}</p>
                  </div>
                )}
              </div>
            )}

            {/* Variantes */}
            {variants.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-700">{variantLabel}</p>
                  {selectedVariant && (
                    <p className="text-[12px] font-semibold">
                      {selectedVariant.stock > 0
                        ? <span className="text-emerald-700">Stock disponible: {selectedVariant.stock}</span>
                        : <span className="text-rose-500">Sin stock</span>
                      }
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
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
                        className={`relative rounded-xl px-4 py-2.5 text-[13px] font-bold border-2 transition-all duration-200 min-w-[3.5rem] text-center ${outOfStock
                          ? "bg-slate-50 border-slate-150 text-slate-300 line-through cursor-not-allowed"
                          : active
                            ? "bg-slate-900 border-slate-900 text-white shadow-md scale-[1.03]"
                            : "bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:text-slate-900 hover:scale-[1.02]"
                          }`}
                      >
                        {label}
                        {outOfStock && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="block h-px w-4/5 bg-slate-300 rotate-12" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cantidad + CTA */}
            <div className="flex flex-col gap-3 pt-1">
              {/* Cantidad */}
              <div className="flex items-center gap-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-700 flex-1">Cantidad</p>
                <div className="inline-flex items-center rounded-xl border-2 border-slate-200 bg-white overflow-hidden h-11 w-28">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex-1 h-full flex items-center justify-center text-lg font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    −
                  </button>
                  <span className="h-7 min-w-[32px] flex items-center justify-center border-x-2 border-slate-200 text-sm font-bold text-slate-900 tabular-nums">
                    {Math.min(50, Math.max(1, Math.floor(qty || 1)))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(Math.min(50, Math.max(1, available)), q + 1))}
                    className="flex-1 h-full flex items-center justify-center text-lg font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
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
                className="w-full h-13 rounded-xl flex items-center justify-center gap-2.5 text-[14px] font-bold uppercase tracking-wider text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand-500) 100%)",
                  boxShadow: "0 6px 24px rgba(22,78,32,0.30)",
                }}
                onMouseEnter={(e) => { if (available > 0) e.currentTarget.style.boxShadow = "0 10px 32px rgba(22,78,32,0.45)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 6px 24px rgba(22,78,32,0.30)"; }}
              >
                {available <= 0 ? (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    Agotado
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Añadir al carrito
                  </>
                )}
              </button>

              {/* Nota de seguridad */}
              {available > 0 && (
                <p className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                  <svg className="h-3 w-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Compra 100% segura · Producto original
                </p>
              )}
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              {[
                { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", t: "Pago seguro", d: "Comprobante verificado", color: "text-blue-600 bg-blue-50" },
                { icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", t: "Envío directo", d: "Seguimiento en tiempo real", color: "text-violet-600 bg-violet-50" },
                { icon: "M5 13l4 4L19 7", t: "100% Original", d: "Garantía de autenticidad", color: "text-emerald-600 bg-emerald-50" },
                { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", t: "Atención directa", d: "Soporte por WhatsApp", color: "text-emerald-600 bg-emerald-50" },
              ].map(b => (
                <div key={b.t} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-300 hover:shadow-sm transition-all duration-200">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${b.color}`}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={b.icon} />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-900 leading-tight">{b.t}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{b.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Productos recomendados */}
        {recommended.length > 0 && (
          <div className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">

            {/* Header de sección */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-4 mb-4 flex items-center justify-between gap-4">
              {/* Orb decorativo */}
              <div className="pointer-events-none absolute right-0 top-0 h-20 w-40 rounded-full bg-emerald-500/8 blur-3xl" aria-hidden />
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-0.5">Descubre más</p>
                <h2 className="text-[16px] sm:text-[18px] font-display font-extrabold text-white leading-tight">También te puede gustar</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">{recommended.length} productos seleccionados para ti</p>
              </div>
              <Link
                href="/catalog"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-white/15 transition-all duration-200"
              >
                Ver todo
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Grid de productos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {recommended.map((it) => (
                <ProductCard key={it.id} p={it} />
              ))}
            </div>

            {/* CTA final */}
            <div className="mt-6 flex justify-center">
              <Link
                href="/catalog"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-8 py-3 text-[13px] font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Ver catálogo completo
              </Link>
            </div>

          </div>
        )}
      </div>

      {/* ══ MODAL CARRITO ════════════════════════════════════════════ */}
      {showCartModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 backdrop-blur-sm p-3 sm:items-center sm:p-6">
          <div className="w-full max-w-[440px] fade-in-up">
            <div className="max-h-[85dvh] overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-[var(--shadow-elevated)] flex flex-col">

              {/* Modal Header */}
              <div className="flex-shrink-0 flex items-start justify-between gap-4 p-5 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 mb-1 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Añadido al carrito
                  </p>
                  <h2 className="text-[18px] font-bold text-slate-900">¿Continúas comprando?</h2>
                </div>
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors"
                  onClick={() => setShowCartModal(false)}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50">
                <div className="flex gap-3 rounded-xl bg-white border border-slate-200 p-3 shadow-sm">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                    {mainImg && (
                      <Image
                        src={optimizedProductImage(mainImg, 180)}
                        alt={String(data.name ?? "")}
                        fill
                        unoptimized
                        sizes="64px"
                        className="object-contain p-1"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                    <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">{String(data.name ?? "")}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      {selectedVariant?.size && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">{variantLabel}: {selectedVariant.size}</span>
                      )}
                      <span>{addedQty} unidad{addedQty !== 1 ? "es" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center pl-2 shrink-0">
                    <p className="text-[15px] font-black text-slate-900 tabular-nums">{formatPEN(modalSubtotal)}</p>
                  </div>
                </div>

                {recommended.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5 text-center">Productos relacionados</h3>
                    <div className="flex gap-2.5 overflow-x-auto pb-1 justify-center">
                      {recommended.slice(0, 3).map((it) => {
                        const price = it.onSale && typeof it.salePrice === "number" ? it.salePrice : it.price;
                        const imgUrl = it.imageUrl || it.imageUrls?.[0] || "";
                        return (
                          <Link
                            key={it.id}
                            href={`/p/${it.id}`}
                            className="w-[110px] shrink-0 rounded-xl bg-white border border-slate-200 p-2 hover:border-slate-300 hover:shadow-sm transition-all duration-200 group"
                            onClick={() => setShowCartModal(false)}
                          >
                            <div className="relative aspect-square overflow-hidden rounded-lg bg-slate-50 mb-1.5">
                              {imgUrl && (
                                <Image
                                  src={optimizedProductImage(imgUrl, 180)}
                                  alt={it.name}
                                  fill
                                  unoptimized
                                  sizes="110px"
                                  className="object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                                />
                              )}
                            </div>
                            <p className="line-clamp-2 text-[10px] font-semibold text-slate-600 leading-tight mb-1">{it.name}</p>
                            <p className="text-[12px] font-black text-slate-900 tabular-nums">{formatPEN(price)}</p>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex-shrink-0 flex flex-col gap-2 p-4 border-t border-slate-100 bg-white">
                <Link
                  href="/cart"
                  className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-white transition-all duration-200"
                  style={{ background: "linear-gradient(135deg, var(--brand-700) 0%, var(--brand-500) 100%)" }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  Ver mi carrito
                </Link>
                <button
                  type="button"
                  onClick={() => setShowCartModal(false)}
                  className="w-full h-11 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  Seguir comprando
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
