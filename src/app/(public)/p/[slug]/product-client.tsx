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
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-sm text-[#8C7A6B] animate-pulse font-medium">Cargando producto...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-sm text-rose-500">{error}</p>
        <Link href="/catalog" className="text-sm text-[#8C7A6B] underline hover:text-[#7A6A5C]">Volver al catálogo</Link>
      </div>
    );
  }
  if (!data) return null;

  return (
    <>
      <div className="min-h-screen bg-[#FAFAF8] text-[#2C2A29]">

        {/* ── Breadcrumb ──────────────────────────────────── */}
        <div className="mx-auto max-w-6xl px-4 pt-5 pb-3 sm:px-6">
          <nav className="flex items-center gap-2 text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider">
            <Link href="/" className="hover:text-[#2C2A29] transition-colors">Inicio</Link>
            <span className="text-[#D3CBC2]">/</span>
            <Link href="/catalog" className="hover:text-[#2C2A29] transition-colors">Catálogo</Link>
            <span className="text-[#D3CBC2]">/</span>
            <span className="text-[#2C2A29] truncate max-w-[200px]">{String(data.name ?? "")}</span>
          </nav>
        </div>

        {/* ── Layout principal ─────────────────────────────── */}
        {/* Aquí centramos mejor en PC con grid-cols-2 simétrico y align-center cuando es posible, añadiendo max-w-5xl o 6xl según guste */}
        <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-4 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">

          {/* ════ GALERÍA ════════════════════════════════════ */}
          <div className="flex flex-col gap-4 lg:gap-5 lg:sticky lg:top-24">

            {/* Imagen principal */}
            <div className="relative overflow-hidden rounded-[2rem] bg-white border border-[#EBE8E1] shadow-sm">
              {hasDiscount && (
                <div className="absolute left-4 top-4 z-10 flex gap-2">
                  <span className="rounded-lg bg-[#DE5D4E] px-2.5 py-1 text-[10px] uppercase font-bold text-white tracking-widest shadow-sm">
                    Oferta
                  </span>
                  <span className="rounded-lg bg-[#2C2A29]/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white tracking-widest">
                    -{discountPct}%
                  </span>
                </div>
              )}

              {/* Contenedor de imagen más pequeño */}
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
                  <div className="text-xs text-[#8C7A6B]">Sin foto</div>
                )}
              </div>

              {/* Controles galería PC/Móvil */}
              {galleryUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Imagen anterior"
                    onClick={() => setImgIndex((i) => (i - 1 + galleryUrls.length) % galleryUrls.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-[#EBE8E1] text-[#2C2A29] hover:bg-white transition-all duration-200"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Siguiente imagen"
                    onClick={() => setImgIndex((i) => (i + 1) % galleryUrls.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white/80 backdrop-blur-md shadow-sm border border-[#EBE8E1] text-[#2C2A29] hover:bg-white transition-all duration-200"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>

                  {/* Paginación tipo "Saga Falabella" (Localizada abajo de imagen en móvil) */}
                  <div className="absolute bottom-4 left-0 right-0 lg:hidden flex justify-center gap-1.5 z-10">
                    {galleryUrls.map((_, i) => (
                      <span
                        key={i}
                        className={`block h-1.5 rounded-full transition-all duration-300 ${i === imgIndex ? "w-4 bg-[#2C2A29]" : "w-1.5 bg-[#8C7A6B]/50"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails (PC - Abajo estilo Adidas u horizontales) */}
            {galleryUrls.length > 1 && (
              <div className="hidden lg:flex gap-3 overflow-x-auto pb-2 scrollbar-hide justify-center">
                {galleryUrls.slice(0, 8).map((url, i) => (
                  <button
                    key={`${url}-desktop-${i}`}
                    type="button"
                    onClick={() => setImgIndex(i)}
                    className={`shrink-0 h-[70px] w-[70px] overflow-hidden rounded-2xl border-2 transition-all duration-300 ${i === imgIndex
                      ? "border-[#2C2A29] opacity-100 ring-2 ring-[#2C2A29]/10 ring-offset-2 ring-offset-[#FAFAF8]"
                      : "border-transparent opacity-60 hover:opacity-100 hover:border-[#D3CBC2] bg-white border-[#EBE8E1]"
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
          <div className="mt-8 flex flex-col gap-7 lg:mt-0 lg:py-6">

            {/* Nombre y marca */}
            <div>
              {data.brand && (
                <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#8C7A6B] mb-2.5">
                  {String(data.brand)}
                </p>
              )}
              <h1 className="text-[30px] sm:text-[36px] font-display font-bold leading-[1.1] text-[#2C2A29] tracking-tight">
                {String(data.name ?? "")}
              </h1>
            </div>

            {/* Precio */}
            <div className="flex items-end gap-3 pb-5 border-b border-[#EBE8E1]">
              <span className="text-[32px] sm:text-[38px] font-extrabold text-[#2C2A29] leading-none">
                {formatPEN(unitPrice)}
              </span>
              {hasDiscount && (
                <div className="flex flex-col mb-1.5 gap-0.5">
                  <span className="text-sm font-medium text-[#A39E98] line-through leading-none">
                    {formatPEN(data.price)}
                  </span>
                </div>
              )}
            </div>

            {/* Especificaciones */}
            {specsText && (
              <div className="rounded-2xl border border-[#EBE8E1] bg-white overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowSpecs((v) => !v)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-[#FAF9F7] transition-colors"
                >
                  <span className="text-[13px] font-bold uppercase tracking-widest text-[#2C2A29]">Especificaciones</span>
                  <svg
                    className={`h-4 w-4 text-[#8C7A6B] transition-transform duration-300 ${showSpecs ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showSpecs && (
                  <div className="border-t border-[#EBE8E1] px-6 pb-6 pt-4">
                    <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#5A544F]">{specsText}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tallas / Variantes como pills */}
            {variants.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold uppercase tracking-widest text-[#2C2A29]">
                    {variants[0]?.size ? "Talla" : variants[0]?.color ? "Color" : "Opciones"}
                  </p>
                  {selectedVariant && (
                    <p className="text-[12px] font-semibold text-[#8C7A6B]">
                      {selectedVariant.stock > 0
                        ? <span className="text-[#3E5245]">Stock: {selectedVariant.stock}</span>
                        : <span className="text-[#DE5D4E]">Agotado</span>
                      }
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
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
                        className={`relative rounded-xl px-5 py-2.5 text-[14px] font-bold border-2 transition-all duration-200 min-w-[3.5rem] ${outOfStock
                          ? "bg-white border-[#EBE8E1] text-[#D3CBC2] line-through cursor-not-allowed"
                          : active
                            ? "bg-[#2C2A29] border-[#2C2A29] text-white"
                            : "bg-white border-[#EBE8E1] text-[#5A544F] hover:border-[#8C7A6B] hover:text-[#2C2A29]"
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
            <div className="flex flex-col gap-5 mt-4">
              <div className="flex items-center gap-4">
                <p className="text-[12px] font-bold uppercase tracking-widest text-[#2C2A29] flex-1">Cantidad</p>
                {/* Stepper +/- */}
                <div className="inline-flex items-center rounded-xl border-2 border-[#EBE8E1] bg-white overflow-hidden h-14 w-32">
                  <button
                    type="button"
                    title="Reducir"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex-1 h-full flex items-center justify-center text-xl font-medium text-[#8C7A6B] hover:bg-[#FAF9F7] transition-colors"
                  >
                    −
                  </button>
                  <span className="h-8 min-w-[32px] flex items-center justify-center border-x-2 border-[#EBE8E1] text-[15px] font-bold text-[#2C2A29]">
                    {Math.min(50, Math.max(1, Math.floor(qty || 1)))}
                  </span>
                  <button
                    type="button"
                    title="Aumentar"
                    onClick={() => setQty((q) => Math.min(Math.min(50, Math.max(1, available)), q + 1))}
                    className="flex-1 h-full flex items-center justify-center text-xl font-medium text-[#8C7A6B] hover:bg-[#FAF9F7] transition-colors"
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
                className="group w-full h-[60px] rounded-2xl bg-[#2C2A29] font-extrabold text-white shadow-xl hover:bg-[#1A1918] hover:shadow-2xl transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="relative text-[16px] tracking-widest uppercase">
                  {available <= 0 ? "Agotado" : "Añadir a la Cesta"}
                </span>
              </button>
            </div>

            {/* Trust badges compacitos */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              {[
                { e: "🔒", t: "Compra segura", d: "Pago verificado" },
                { e: "📦", t: "Envíos directos", d: "Seguimiento real" },
                { e: "✅", t: "100% Original", d: "Calidad garantizada" },
                { e: "💬", t: "Atención al Cliente", d: "Soporte WhatsApp" },
              ].map(b => (
                <div key={b.t} className="flex items-center gap-3 rounded-2xl border border-[#EBE8E1] bg-white px-4 py-3.5 shadow-sm">
                  <span className="text-xl opacity-80 shrink-0">{b.e}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#2C2A29] truncate">{b.t}</p>
                    <p className="text-[11px] text-[#8C7A6B] mt-0.5 truncate">{b.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ════ MODAL CARRITO ═══════════════════════════════════ */}
      {/* ════ MODAL CARRITO (WARM TIERRA THEME) ══════════════ */}
      {showCartModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#2C2A29]/60 backdrop-blur-sm p-3 sm:items-center sm:p-6">
          <div className="w-full max-w-[420px] sm:max-w-[480px] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="max-h-[85dvh] overflow-hidden rounded-[2rem] bg-white border border-[#EBE8E1] shadow-[0_20px_60px_rgba(44,42,41,0.15)] flex flex-col">
              <div className="flex-shrink-0 flex items-start justify-between gap-4 p-6 pb-4 border-b border-[#EBE8E1]">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-[#3E5245] mb-1.5 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Añadido con éxito
                  </p>
                  <h2 className="text-[22px] font-extrabold text-[#2C2A29]">Continúa tu compra</h2>
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FAFAF8] text-[#8C7A6B] hover:bg-[#EBE8E1] hover:text-[#2C2A29] transition-colors"
                  onClick={() => setShowCartModal(false)}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-[#FAFAF8]">
                {/* Preview del artículo añadido */}
                <div className="flex gap-4 rounded-2xl bg-white border border-[#EBE8E1] p-4 shadow-sm">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#FAFAF8] border border-[#EBE8E1]">
                    {mainImg && <img src={mainImg} alt={String(data.name ?? "")} className="h-full w-full object-contain p-1" />}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-[15px] font-bold text-[#2C2A29] line-clamp-2 leading-tight">{String(data.name ?? "")}</p>
                    <p className="text-[13px] font-medium text-[#8C7A6B] mt-1.5 flex items-center gap-1.5">
                      <span className="bg-[#EBE8E1] px-1.5 py-0.5 rounded text-[11px] text-[#5A544F]">
                        {selectedVariant?.size ? `${selectedVariant.size}` : selectedVariant?.color ?? ""}
                      </span>
                      <span className="opacity-40">•</span>
                      <span>{addedQty} un.</span>
                    </p>
                  </div>
                  <div className="flex items-center pl-2">
                    <p className="text-[17px] font-extrabold text-[#2C2A29]">{formatPEN(modalSubtotal)}</p>
                  </div>
                </div>

                {/* Recomendados con tema Light */}
                {recommended.length > 0 && (
                  <div>
                    <h3 className="text-[12px] font-bold uppercase tracking-widest text-[#2C2A29] mb-3">Sugerencias para ti</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {recommended.map((it) => {
                        const price = it.onSale && typeof it.salePrice === "number" ? it.salePrice : it.price;
                        const img = it.imageUrl || it.imageUrls?.[0] || "";
                        return (
                          <Link
                            key={it.id}
                            href={`/p/${it.id}`}
                            className="w-[130px] shrink-0 rounded-2xl bg-white border border-[#EBE8E1] p-2.5 hover:border-[#8C7A6B] hover:shadow-md transition-all duration-300 group"
                          >
                            <div className="aspect-square overflow-hidden rounded-xl bg-[#FAFAF8] mb-3 relative">
                              {img && <img src={img} alt={it.name} className="h-full w-full object-contain p-2 group-hover:scale-105 transition-transform duration-500" />}
                            </div>
                            <p className="line-clamp-2 text-[12px] font-bold text-[#5A544F] leading-tight mb-1.5 group-hover:text-[#2C2A29]">{it.name}</p>
                            <p className="text-[14px] font-extrabold text-[#2C2A29]">{formatPEN(price)}</p>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Botones Acciones Sticky al fondo */}
              <div className="flex-shrink-0 flex flex-col gap-3 p-6 pt-0 bg-[#FAFAF8] border-t-0">
                <Link
                  href="/cart"
                  className="w-full h-14 flex items-center justify-center rounded-2xl bg-[#2C2A29] text-[15px] font-extrabold tracking-widest uppercase text-white hover:bg-[#1A1918] shadow-lg transition-all"
                >
                  Ver mi carrito
                </Link>
                <button
                  type="button"
                  onClick={() => setShowCartModal(false)}
                  className="w-full h-14 flex items-center justify-center rounded-2xl border-2 border-[#EBE8E1] bg-white text-[14px] font-bold uppercase tracking-widest text-[#5A544F] hover:border-[#8C7A6B] hover:text-[#2C2A29] transition-all"
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
