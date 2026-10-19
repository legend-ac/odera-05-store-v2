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
import ProductImage, { ProductImagePlaceholder, useProductImages } from "@/components/ProductImage";
import { productImageDelivery } from "@/lib/image";
import SizeGuide from "@/components/SizeGuide";
import { clampProductQuantity, initialProductVariant } from "@/lib/productSelection";

type Variant = { id: string; size?: string; color?: string; sku?: string; stock: number };
type Img = { url: string; alt?: string; isMain: boolean; order: number };

/* ── Inline style tokens ── */
const S = {
  ink:    "var(--ink)",
  ink2:   "var(--ink-2)",
  ink3:   "var(--ink-3)",
  paper:  "var(--paper)",
  ash:    "var(--ash)",
  ash2:   "var(--ash-2)",
  red:    "var(--vermeil)",
  red2:   "var(--vermeil-2)",
  gold:   "var(--gold)",
  border: "1px solid var(--ash-2)",
};

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
  const [showSpecs, setShowSpecs] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [addedQty, setAddedQty] = useState(1);
  const [recommended, setRecommended] = useState<ProductCardData[]>(initialRecommended);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    if (initialProduct) {
      setData(initialProduct);
      setLoading(false);
      const variants = Array.isArray(initialProduct.variants) ? (initialProduct.variants as Variant[]) : [];
      setVariantId(initialProductVariant(variants));
      setQty(1);
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
        if (mounted) {
          setVariantId(initialProductVariant(variants));
          setQty(1);
        }
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

  const gallery = useProductImages(galleryUrls, slug);
  const mainImg = gallery.current;
  const availableGalleryUrls = gallery.availableUrls;
  const available = selectedVariant ? selectedVariant.stock : 0;
  const purchaseQty = clampProductQuantity(qty, available);
  const modalSubtotal = useMemo(() => unitPrice * addedQty, [unitPrice, addedQty]);
  const variantLabel = variants[0]?.size ? "Talla" : variants[0]?.color ? "Color" : "Opción";

  function showPreviousImage() { gallery.previous(); }
  function showNextImage() { gallery.next(); }

  function onGalleryPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (availableGalleryUrls.length <= 1) return;
    dragStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onGalleryPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start || availableGalleryUrls.length <= 1) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) showNextImage(); else showPreviousImage();
  }

  /* ── Loading / Error states ── */
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4" style={{ background: S.ink }}>
        <div className="h-8 w-8 border-2 border-t-[var(--vermeil)] animate-spin" style={{ borderColor: "var(--ash-2)", borderTopColor: "var(--vermeil)", borderRadius: "50%" }} />
        <p style={{ fontSize: "13px", color: S.ash }}>Cargando producto...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4 text-center" style={{ background: S.ink }}>
        <div className="flex items-center justify-center" style={{ width: 56, height: 56, background: "rgba(232,69,44,0.1)", border: S.border, borderRadius: "2px" }}>
          <svg className="h-6 w-6" style={{ color: S.red }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <p className="font-bold" style={{ color: S.paper, fontSize: "15px" }}>{error}</p>
          <Link href="/catalog" prefetch={false} className="mt-2 inline-block font-semibold hover:underline" style={{ fontSize: "13px", color: S.red }}>
            ← Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <>
      <div className="product-page" style={{ background: S.ink }}>

        {/* ── Breadcrumb ── */}
        <div style={{ background: S.ink2, borderBottom: S.border }}>
          <div className="product-breadcrumb mx-auto max-w-7xl px-4 py-3 sm:px-6">
            <nav aria-label="Ruta del producto" className="flex min-w-0 items-center gap-2" style={{ fontSize: "12px", color: S.ash }}>
              <Link href="/" className="hover:text-[var(--vermeil)] transition-colors">Inicio</Link>
              <span style={{ color: S.ash2 }}>›</span>
              <Link href="/catalog" prefetch={false} className="hover:text-[var(--vermeil)] transition-colors">Catálogo</Link>
              <span style={{ color: S.ash2 }}>›</span>
              <span style={{ color: S.paper, fontWeight: 600 }} className="truncate max-w-[160px] sm:max-w-none">
                {String(data.name ?? "")}
              </span>
            </nav>
          </div>
        </div>

        {/* ── Layout principal ── */}
        <div className="product-layout mx-auto px-4 sm:px-6">

          {/* ══ GALERÍA ══ */}
          <div className="product-gallery flex min-w-0 flex-col gap-3 lg:sticky lg:top-20">

            {/* Imagen principal */}
            <div
              className="product-gallery__frame relative overflow-hidden"
            >
              <div
                className="product-gallery__image relative flex touch-pan-y cursor-grab select-none items-center justify-center overflow-hidden w-full active:cursor-grabbing"
                style={{ aspectRatio: "1 / 1", background: "var(--image-surface)" }}
                onPointerDown={onGalleryPointerDown}
                onPointerUp={onGalleryPointerUp}
                onPointerCancel={() => { dragStart.current = null; }}
              >
                {mainImg ? (
                  <Image
                    key={mainImg}
                    {...productImageDelivery(mainImg, 1200)}
                    alt={data.name ?? ""}
                    fill
                    priority
                    decoding="async"
                    draggable={false}
                    sizes="(max-width: 599px) calc(100vw - 32px), (max-width: 767px) 568px, (max-width: 1023px) calc((100vw - 76px) / 2), (max-width: 1199px) calc((100vw - 224px) / 2), 488px"
                    className="object-contain"
                    onError={() => gallery.reportFailure(mainImg)}
                  />
                ) : (
                  <ProductImagePlaceholder name={String(data.name ?? "")} />
                )}
              </div>

            </div>

            {availableGalleryUrls.length > 1 && <div className="product-gallery__navigation" aria-label="Controles de fotos">
                  <button type="button" aria-label="Imagen anterior" onClick={showPreviousImage}
                    className="product-gallery__arrow"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="product-gallery__count" aria-live="polite" aria-label={`Imagen ${availableGalleryUrls.indexOf(mainImg) + 1} de ${availableGalleryUrls.length}`}>
                    {availableGalleryUrls.indexOf(mainImg) + 1} / {availableGalleryUrls.length}
                  </span>
                  <button type="button" aria-label="Siguiente imagen" onClick={showNextImage}
                    className="product-gallery__arrow"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
              </div>}

            {/* Thumbnails */}
            {availableGalleryUrls.length > 1 && (
              <div className="product-gallery__thumbnails flex gap-2 overflow-x-auto pb-1" aria-label="Fotos del producto">
                {availableGalleryUrls.map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={() => gallery.select(url)}
                    aria-label={`Ver imagen ${i + 1} de ${data.name ?? "producto"}`}
                    aria-pressed={url === mainImg}
                    className="product-gallery__thumbnail relative shrink-0 overflow-hidden transition-all duration-200"
                    style={{
                      width: "var(--product-thumbnail-size, 64px)", height: "var(--product-thumbnail-size, 64px)",
                      background: "var(--image-surface)",
                      border: url === mainImg ? `2px solid var(--vermeil)` : `1px solid var(--ash-2)`,
                      borderRadius: "2px",
                      opacity: url === mainImg ? 1 : 0.8,
                    }}
                  >
                    <Image
                      {...productImageDelivery(url, 180)}
                      alt={`${data.name ?? ""} vista ${i + 1}`}
                      fill loading="lazy" decoding="async" draggable={false}
                      sizes="(max-width: 767px) 48px, 56px"
                      className="object-contain p-1"
                      onError={() => gallery.reportFailure(url)}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ══ PANEL INFO ══ */}
          <div className="product-info mt-6 flex min-w-0 flex-col gap-5 lg:mt-0 lg:py-2">

            {/* Marca + Nombre */}
            <div className="product-heading">
              {data.brand && (
                <p className="font-bold uppercase mb-2" style={{ fontSize: "10px", letterSpacing: "0.28em", color: S.red }}>
                  {String(data.brand)}
                </p>
              )}
              <h1
                className="product-title font-black leading-tight"
                style={{
                  fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
                  fontSize: "var(--product-title-size, clamp(28px, 5vw, 42px))",
                  letterSpacing: "0.04em",
                  color: S.paper,
                }}
              >
                {String(data.name ?? "")}
              </h1>
            </div>

            {/* Precio */}
            <div className="product-price flex flex-wrap items-end gap-4 pb-5" style={{ borderBottom: S.border }}>
              <span className="product-price__current" style={{ color: hasDiscount ? S.red : S.paper }}>
                {formatPEN(unitPrice)}
              </span>
              {hasDiscount && (
                <>
                  <span className="product-price__original">
                    {formatPEN(data.price)}
                  </span>
                  <span className="product-discount">−{discountPct}%</span>
                </>
              )}
            </div>

            {/* Variantes / Tallas */}
            {variants.length > 0 && (
              <div className="product-variants flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="font-bold uppercase" style={{ fontSize: "10px", letterSpacing: "0.2em", color: S.ash }}>
                    {variantLabel}
                  </p>
                  {selectedVariant && (
                    <p style={{ fontSize: "12px", fontWeight: 600, color: selectedVariant.stock > 0 ? "var(--success)" : S.red }}>
                      {selectedVariant.stock > 0 ? `Stock: ${selectedVariant.stock}` : "Sin stock"}
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
                        onClick={() => { setVariantId(v.id); setQty((current) => clampProductQuantity(current, v.stock)); }}
                        aria-pressed={active}
                        aria-label={`${variantLabel} ${[v.size, v.color].filter(Boolean).join(" · ") || v.id}${outOfStock ? ", agotado" : ""}`}
                        className="product-variant relative font-bold transition-all duration-150 text-center"
                        style={{
                          minWidth: "3.5rem",
                          padding: "8px 16px",
                          fontSize: "13px",
                          letterSpacing: "0.06em",
                          border: active ? `2px solid var(--vermeil)` : `1px solid var(--ash-2)`,
                          borderRadius: "2px",
                          background: active ? "var(--vermeil)" : outOfStock ? S.ink3 : "transparent",
                          color: active ? "#fff" : outOfStock ? S.ash2 : S.paper,
                          opacity: outOfStock ? 0.45 : 1,
                          cursor: outOfStock ? "not-allowed" : "pointer",
                          textDecoration: outOfStock ? "line-through" : "none",
                        }}
                      >
                        {label}{v.size && v.color && <span className="block text-[10px] font-normal tracking-normal">{v.color}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cantidad + CTA */}
            <div className="product-purchase flex flex-col gap-3">
              <div className="product-buy-row">
              {/* Cantidad */}
              <div className="product-quantity flex items-center gap-4">
                <p className="font-bold uppercase flex-1" style={{ fontSize: "10px", letterSpacing: "0.2em", color: S.ash }}>
                  Cantidad
                </p>
                <div className="product-quantity__stepper inline-flex items-center overflow-hidden" style={{ border: S.border, borderRadius: "2px", height: 44, width: 112 }}>
                  <button type="button" aria-label="Reducir cantidad" disabled={purchaseQty <= 1} onClick={() => setQty(Math.max(1, purchaseQty - 1))}
                    className="flex-1 h-full flex items-center justify-center text-lg transition-colors"
                    style={{ color: S.ash, background: "transparent" }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = S.ink3; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
                  >−</button>
                  <span className="h-7 min-w-[32px] flex items-center justify-center tabular-nums font-bold" style={{ borderLeft: S.border, borderRight: S.border, color: S.paper, fontSize: "14px" }}>
                    {purchaseQty}
                  </span>
                  <button type="button" aria-label="Aumentar cantidad" disabled={purchaseQty >= Math.min(50, available)} onClick={() => setQty(Math.min(50, available, purchaseQty + 1))}
                    className="flex-1 h-full flex items-center justify-center text-lg transition-colors"
                    style={{ color: S.ash, background: "transparent" }}
                    onMouseEnter={(e) => { (e.target as HTMLElement).style.background = S.ink3; }}
                    onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
                  >+</button>
                </div>
              </div>

              {/* Botón principal */}
              <button
                type="button"
                disabled={!variantId || available <= 0}
                onClick={() => {
                  const safeQty = purchaseQty;
                  addItem({ productId: data.id, variantId, qty: safeQty });
                  setAddedQty(safeQty);
                  setShowCartModal(true);
                }}
                className="product-add-to-cart w-full flex items-center justify-center gap-2.5 font-black uppercase tracking-widest text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
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
              </div>

            </div>

            <div className="product-services" aria-label="Pago y entrega">
              <div className="product-service">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18v13H3V7Zm0 0 14-4v4m-1 6h5m-4 3h.01" /></svg>
                <div><p>Yape y Plin</p><span>Revisamos tu comprobante de pago.</span></div>
              </div>
              <div className="product-service">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="m3 7 9-4 9 4-9 4-9-4Zm0 0v10l9 4 9-4V7M12 11v10" /></svg>
                <div><p>Lima y provincias</p><span>Consulta las opciones de entrega.</span></div>
              </div>
            </div>
            <nav aria-label="Información antes de comprar" className="product-policies" style={{ color: S.ash }}>
              <Link href="/informacion/envios" className="underline underline-offset-4 hover:text-[var(--paper)]">Envíos y entregas</Link>
              <Link href="/informacion/cambios-devoluciones" className="underline underline-offset-4 hover:text-[var(--paper)]">Cambios y devoluciones</Link>
            </nav>
          </div>
        </div>

        <div className="product-extras mx-auto px-4 sm:px-6">
          <div className="product-details">
            {data.productType === "zapatillas" && variants.some((v) => v.size) && <SizeGuide />}

            {specsText && (
              <div className="product-specifications">
                <button type="button" aria-expanded={showSpecs} aria-controls="product-specifications" onClick={() => setShowSpecs((value) => !value)} className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-left transition-colors" style={{ background: showSpecs ? S.ink3 : "transparent" }}>
                  <span className="font-bold uppercase" style={{ fontSize: "11px", letterSpacing: "0.12em", color: S.paper }}>Detalles del producto</span>
                  <svg aria-hidden="true" className={`h-4 w-4 transition-transform duration-300 ${showSpecs ? "rotate-180" : ""}`} style={{ color: S.ash }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {showSpecs && <div id="product-specifications" className="px-4 pb-4 pt-3" style={{ background: S.ink3, borderTop: S.border }}><p className="whitespace-pre-wrap leading-relaxed" style={{ fontSize: "13px", color: S.ash }}>{specsText}</p></div>}
              </div>
            )}
            </div>
        </div>

        {/* ── Productos recomendados ── */}
        {recommended.length > 0 && (
          <div className="product-related mx-auto max-w-7xl px-4 pb-14 sm:px-6">
            <div className="flex items-center justify-between gap-3 pb-4 mb-6" style={{ borderBottom: S.border }}>
              <div className="min-w-0">
                <p className="font-black uppercase mb-1" style={{ fontSize: "10px", letterSpacing: "0.28em", color: S.red }}>
                  Descubre más
                </p>
                <h2 className="font-black" style={{ fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif", color: S.paper }}>
                  TAMBIÉN TE PUEDE GUSTAR
                </h2>
              </div>
              <Link href="/catalog" prefetch={false} className="shrink-0 whitespace-nowrap font-bold uppercase transition-colors hover:text-[var(--vermeil)]"
                style={{ fontSize: "11px", letterSpacing: "0.1em", color: S.ash }}>
                Ver todo →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {recommended.map((it) => (
                <ProductCard key={it.id} p={it} />
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <Link href="/catalog" prefetch={false} className="btn-soft" style={{ fontSize: "12px", padding: "10px 28px" }}>
                Ver catálogo completo →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ══ MODAL CARRITO ══ */}
      {showCartModal && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center sm:p-6" style={{ background: "var(--overlay)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-[540px] fade-in-up">
            <div className="max-h-[85dvh] overflow-hidden flex flex-col" style={{ background: S.ink2, border: "1px solid var(--ash-2)", borderRadius: "2px", boxShadow: "var(--shadow-elevated)" }}>

              {/* Modal Header */}
              <div className="flex-shrink-0 flex items-start justify-between gap-4 p-5 pb-4" style={{ borderBottom: S.border }}>
                <div>
                  <p className="font-bold uppercase mb-1 flex items-center gap-1.5" style={{ fontSize: "10px", letterSpacing: "0.2em", color: "var(--success)" }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Añadido al carrito
                  </p>
                  <h2 className="font-black" style={{ fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif", fontSize: "22px", letterSpacing: "0.06em", color: S.paper }}>
                    ¿Continúas comprando?
                  </h2>
                </div>
                <button type="button" onClick={() => setShowCartModal(false)}
                  className="flex items-center justify-center transition-colors"
                  style={{ width: 32, height: 32, background: S.ink3, border: S.border, borderRadius: "2px", color: S.ash }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4" style={{ background: S.ink3 }}>
                <div className="flex gap-3 p-3" style={{ background: S.ink2, border: S.border, borderRadius: "2px" }}>
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden" style={{ background: S.ink3, border: S.border, borderRadius: "2px" }}>
                    <ProductImage sources={availableGalleryUrls} productId={slug} imageWidth={180} compact alt={String(data.name ?? "")} fill unoptimized sizes="64px" className="object-contain p-1" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                    <p className="font-bold line-clamp-2 leading-snug" style={{ fontSize: "13px", color: S.paper }}>{String(data.name ?? "")}</p>
                    <div className="flex items-center gap-2" style={{ fontSize: "11px", color: S.ash }}>
                      {selectedVariant?.size && (
                        <span style={{ background: S.ink3, padding: "1px 6px", fontSize: "10px", color: S.paper, borderRadius: "1px" }}>
                          {variantLabel}: {selectedVariant.size}
                        </span>
                      )}
                      <span>{addedQty} unidad{addedQty !== 1 ? "es" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center pl-2 shrink-0">
                    <p className="font-black tabular-nums" style={{ fontSize: "16px", color: S.paper }}>{formatPEN(modalSubtotal)}</p>
                  </div>
                </div>

                {recommended.length > 0 && (
                  <div className="rounded-sm p-3" style={{ background: "var(--ink)", border: S.border }}>
                    <h3 className="font-bold uppercase mb-3" style={{ fontSize: "10px", letterSpacing: "0.18em", color: S.ash }}>
                      Relacionados
                    </h3>
                    <div className="grid grid-cols-3 gap-2.5">
                      {recommended.slice(0, 3).map((it) => {
                        const price = it.onSale && typeof it.salePrice === "number" ? it.salePrice : it.price;
                        return (
                          <Link key={it.id} href={`/p/${it.id}`} onClick={() => setShowCartModal(false)}
                            className="group flex min-w-0 flex-col p-2.5 transition-all duration-200 hover:-translate-y-0.5"
                            style={{ background: S.ink2, border: S.border, borderRadius: "2px" }}
                          >
                            <div className="relative aspect-[4/3] overflow-hidden mb-2" style={{ background: S.ink3 }}>
                              <ProductImage sources={[it.imageUrl, ...(it.imageUrls ?? [])]} productId={it.id} imageWidth={240} compact alt={it.name} fill unoptimized sizes="(max-width: 640px) 30vw, 150px" className="object-contain p-1 transition-transform duration-300 group-hover:scale-105" />
                            </div>
                            <p className="line-clamp-2 min-h-[2.5em] leading-tight mb-2" style={{ fontSize: "11px", color: S.paper }}>{it.name}</p>
                            <p className="mt-auto font-black tabular-nums" style={{ fontSize: "14px", color: S.paper }}>{formatPEN(price)}</p>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex-shrink-0 flex flex-col gap-2 p-4" style={{ borderTop: S.border, background: S.ink2 }}>
                <Link href="/cart" className="btn-brand justify-center w-full" style={{ fontSize: "13px", padding: "14px" }}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  Ver mi carrito
                </Link>
                <button type="button" onClick={() => setShowCartModal(false)} className="btn-soft w-full justify-center" style={{ fontSize: "13px", padding: "12px" }}>
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
