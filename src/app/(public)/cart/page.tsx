"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCart } from "@/components/cart/CartProvider";
import { formatPEN } from "@/lib/money";
import { optimizedProductImage } from "@/lib/image";

/* ── Style tokens ── */
const S = {
  ink:   "var(--ink)",
  ink2:  "var(--ink-2)",
  ink3:  "var(--ink-3)",
  paper: "var(--paper)",
  ash:   "var(--ash)",
  ash2:  "var(--ash-2)",
  red:   "var(--vermeil)",
  border:"1px solid var(--ash-2)",
};

type ProductData = {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  onSale: boolean;
  images?: { url: string; isMain: boolean; order?: number }[];
  variants: { id: string; size?: string; color?: string; stock: number }[];
};

function getMainImage(p: ProductData): string {
  if (!p.images?.length) return "";
  const sorted = [...p.images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const main = sorted.find((img) => img.isMain) ?? sorted[0];
  return main?.url ? String(main.url) : "";
}

export default function CartPage() {
  const { items, removeItem, setQty, clear } = useCart();
  const [products, setProducts] = useState<Record<string, ProductData>>({});
  const [loading, setLoading] = useState(false);

  const uniqueProductIds = useMemo(
    () => Array.from(new Set(items.map((x) => x.productId))),
    [items]
  );

  useEffect(() => {
    if (!uniqueProductIds.length) { setProducts({}); return; }
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const map: Record<string, ProductData> = {};
        const snaps = await Promise.all(uniqueProductIds.map((id) => getDoc(doc(db, "products", id))));
        for (const snap of snaps) {
          if (!snap.exists()) continue;
          const d = snap.data() as any;
          map[snap.id] = {
            id: snap.id,
            name: String(d.name ?? ""),
            price: Number(d.price ?? 0),
            salePrice: typeof d.salePrice === "number" ? d.salePrice : undefined,
            onSale: Boolean(d.onSale),
            images: Array.isArray(d.images) ? d.images : [],
            variants: Array.isArray(d.variants) ? d.variants : [],
          };
        }
        if (mounted) setProducts(map);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [JSON.stringify(uniqueProductIds)]);

  const lines = useMemo(() => {
    return items.map((it) => {
      const p = products[it.productId];
      const v = p?.variants?.find((x) => x.id === it.variantId);
      const unit = p ? (p.onSale && typeof p.salePrice === "number" ? p.salePrice : p.price) : 0;
      const subtotal = unit * it.qty;
      const imageSrc = p ? getMainImage(p) : "";
      return { it, p, v, unit, subtotal, imageSrc };
    });
  }, [items, products]);

  const total = useMemo(() => lines.reduce((acc, x) => acc + x.subtotal, 0), [lines]);
  const totalItems = useMemo(() => items.reduce((acc, x) => acc + x.qty, 0), [items]);

  return (
    <div style={{ background: S.ink, minHeight: "100vh" }}>

      {/* ── Breadcrumb ── */}
      <div style={{ background: S.ink2, borderBottom: S.border }}>
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <nav className="flex items-center gap-2" style={{ fontSize: "12px", color: S.ash }}>
            <Link href="/" className="hover:text-[var(--vermeil)] transition-colors">Inicio</Link>
            <span style={{ color: S.ash2 }}>›</span>
            <span style={{ color: S.paper, fontWeight: 600 }}>Carrito</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1
              className="font-black leading-none"
              style={{
                fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
                fontSize: "clamp(32px, 6vw, 48px)",
                letterSpacing: "0.06em",
                color: S.paper,
              }}
            >
              CARRITO DE COMPRAS
            </h1>
            <p style={{ fontSize: "13px", color: S.ash, marginTop: "6px" }}>
              {items.length
                ? `${totalItems} producto(s) listo${totalItems !== 1 ? "s" : ""} para continuar tu compra.`
                : "Tu carrito está vacío por ahora."}
            </p>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="font-bold uppercase transition-colors hover:text-[var(--vermeil)]"
              style={{
                fontSize: "11px",
                letterSpacing: "0.12em",
                padding: "8px 16px",
                border: S.border,
                borderRadius: "2px",
                color: S.ash,
                background: "transparent",
              }}
            >
              Vaciar carrito
            </button>
          )}
        </div>

        {/* Carrito vacío */}
        {!items.length && (
          <div
            className="flex flex-col items-center justify-center text-center py-20"
            style={{ background: S.ink2, border: S.border, borderRadius: "2px" }}
          >
            <div
              className="flex items-center justify-center mb-5"
              style={{ width: 64, height: 64, background: S.ink3, border: S.border, borderRadius: "2px" }}
            >
              <svg className="h-8 w-8" style={{ color: S.ash2 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <p className="font-black mb-1" style={{ fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif", fontSize: "24px", letterSpacing: "0.08em", color: S.paper }}>
              CARRITO VACÍO
            </p>
            <p style={{ fontSize: "13px", color: S.ash, marginBottom: "20px", maxWidth: "280px" }}>
              Explora el catálogo y agrega tus favoritos.
            </p>
            <Link href="/catalog" className="btn-brand" style={{ fontSize: "12px", padding: "10px 24px" }}>
              Ver catálogo →
            </Link>
          </div>
        )}

        {/* Cargando */}
        {loading && items.length > 0 && (
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: S.ink2, border: S.border, borderRadius: "2px" }}
          >
            <div
              className="h-4 w-4 animate-spin shrink-0"
              style={{ border: "2px solid var(--ash-2)", borderTopColor: "var(--vermeil)", borderRadius: "50%" }}
            />
            <span style={{ fontSize: "13px", color: S.ash }}>Actualizando carrito...</span>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">

            {/* ── Lista de productos ── */}
            <div className="flex flex-col gap-3">
              {lines.map(({ it, p, v, unit, subtotal, imageSrc }, i) => (
                <div
                  key={`${it.productId}:${it.variantId}`}
                  className="flex gap-4 p-4"
                  style={{
                    background: S.ink2,
                    border: S.border,
                    borderRadius: "2px",
                    animationDelay: `${i * 60}ms`,
                  }}
                >
                  {/* Imagen */}
                  <div
                    className="relative shrink-0 overflow-hidden"
                    style={{ width: 88, height: 88, background: S.ink3, border: S.border, borderRadius: "2px" }}
                  >
                    {imageSrc ? (
                      <Image
                        src={optimizedProductImage(imageSrc, 220)}
                        alt={p?.name ?? "Producto"}
                        fill
                        unoptimized
                        sizes="88px"
                        className="object-contain p-1.5"
                        onError={() => {}}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="h-7 w-7" style={{ color: S.ash2 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                    <div>
                      <p className="font-semibold truncate" style={{ fontSize: "14px", color: S.paper }}>
                        {p?.name ?? it.productId}
                      </p>
                      {v && (
                        <p style={{ fontSize: "11px", color: S.ash, marginTop: "2px" }}>
                          {[v.size && `Talla: ${v.size}`, v.color && `Color: ${v.color}`].filter(Boolean).join(" · ") || v.id}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3" style={{ fontSize: "13px" }}>
                      <span style={{ color: S.ash }}>Unitario: <span className="font-semibold" style={{ color: S.paper }}>{formatPEN(unit)}</span></span>
                      <span style={{ color: "var(--ash-2)" }}>·</span>
                      <span className="font-black tabular-nums" style={{ color: "var(--vermeil)", fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif", fontSize: "18px", letterSpacing: "0.04em" }}>
                        {formatPEN(subtotal)}
                      </span>
                    </div>
                  </div>

                  {/* Controles */}
                  <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                    {/* Qty */}
                    <div className="inline-flex items-center overflow-hidden" style={{ border: S.border, borderRadius: "2px", height: 32 }}>
                      <button
                        type="button"
                        onClick={() => setQty(it.productId, it.variantId, Math.max(1, it.qty - 1))}
                        className="flex items-center justify-center transition-colors"
                        style={{ width: 28, height: "100%", color: S.ash, fontSize: "16px", background: "transparent" }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = S.ink3; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
                      >−</button>
                      <span
                        className="flex items-center justify-center tabular-nums font-bold"
                        style={{ minWidth: 28, height: "100%", borderLeft: S.border, borderRight: S.border, color: S.paper, fontSize: "13px" }}
                      >
                        {it.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(it.productId, it.variantId, Math.min(50, it.qty + 1))}
                        className="flex items-center justify-center transition-colors"
                        style={{ width: 28, height: "100%", color: S.ash, fontSize: "16px", background: "transparent" }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = S.ink3; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "transparent"; }}
                      >+</button>
                    </div>
                    {/* Quitar */}
                    <button
                      type="button"
                      onClick={() => removeItem(it.productId, it.variantId)}
                      className="font-semibold transition-colors hover:text-[var(--vermeil)]"
                      style={{ fontSize: "11px", color: S.ash, letterSpacing: "0.04em" }}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Resumen ── */}
            <div
              className="flex flex-col gap-4 p-5 lg:sticky lg:top-20"
              style={{ background: S.ink2, border: S.border, borderRadius: "2px" }}
            >
              <p
                className="font-black"
                style={{
                  fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
                  fontSize: "22px",
                  letterSpacing: "0.08em",
                  color: S.paper,
                }}
              >
                RESUMEN
              </p>

              <div className="flex flex-col gap-2" style={{ borderBottom: S.border, paddingBottom: "12px" }}>
                <div className="flex items-center justify-between" style={{ fontSize: "13px" }}>
                  <span style={{ color: S.ash }}>Productos</span>
                  <span className="font-semibold" style={{ color: S.paper }}>{totalItems}</span>
                </div>
                <div className="flex items-center justify-between" style={{ fontSize: "13px" }}>
                  <span style={{ color: S.ash }}>Envío</span>
                  <span style={{ color: S.ash }}>Coordinado por WhatsApp</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span style={{ fontSize: "13px", color: S.ash }}>Total</span>
                <span
                  className="font-black tabular-nums"
                  style={{
                    fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
                    fontSize: "28px",
                    letterSpacing: "0.04em",
                    color: S.paper,
                  }}
                >
                  {formatPEN(total)}
                </span>
              </div>

              <p style={{ fontSize: "11px", color: S.ash }}>
                El stock final se confirma al crear el pedido.
              </p>

              <Link
                href="/checkout"
                className="btn-brand justify-center w-full"
                style={{ fontSize: "13px", padding: "14px", textAlign: "center" }}
              >
                Continuar compra →
              </Link>

              <Link
                href="/catalog"
                className="text-center font-semibold transition-colors hover:text-[var(--vermeil)]"
                style={{ fontSize: "12px", color: S.ash, letterSpacing: "0.04em" }}
              >
                Seguir comprando
              </Link>

              {/* Trust strip — tema oscuro */}
              <div
                className="flex items-start gap-2.5 p-3"
                style={{ background: S.ink3, border: S.border, borderRadius: "2px" }}
              >
                <svg className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--vermeil)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p style={{ fontSize: "11px", color: S.ash, lineHeight: "1.5" }}>
                  Compra protegida · pedido registrado, validación de pago manual y seguimiento por número de pedido.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
