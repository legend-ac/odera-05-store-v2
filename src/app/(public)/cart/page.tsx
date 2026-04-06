"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCart } from "@/components/cart/CartProvider";
import { formatPEN } from "@/lib/money";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/fields";

type ProductData = {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  onSale: boolean;
  images?: { url: string; isMain: boolean }[];
  variants: { id: string; size?: string; color?: string; stock: number }[];
};

export default function CartPage() {
  const { items, removeItem, setQty, clear } = useCart();
  const [products, setProducts] = useState<Record<string, ProductData>>({});
  const [loading, setLoading] = useState(false);

  const uniqueProductIds = useMemo(() => Array.from(new Set(items.map((x) => x.productId))), [items]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const map: Record<string, ProductData> = {};
        for (const id of uniqueProductIds) {
          const snap = await getDoc(doc(db, "products", id));
          if (!snap.exists()) continue;
          const d = snap.data() as any;
          map[id] = {
            id,
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
    return () => {
      mounted = false;
    };
  }, [uniqueProductIds]);

  const lines = useMemo(() => {
    return items.map((it) => {
      const p = products[it.productId];
      const v = p?.variants?.find((x) => x.id === it.variantId);
      const unit = p ? (p.onSale && typeof p.salePrice === "number" ? p.salePrice : p.price) : 0;
      const subtotal = unit * it.qty;
      return { it, p, v, unit, subtotal };
    });
  }, [items, products]);

  const total = useMemo(() => lines.reduce((acc, x) => acc + x.subtotal, 0), [lines]);
  const totalItems = useMemo(() => items.reduce((acc, x) => acc + x.qty, 0), [items]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Link href="/" className="hover:text-slate-900 transition-colors">Inicio</Link>
        <span className="text-slate-300">›</span>
        <span className="text-slate-900">Carrito</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900">Carrito de compras</h1>
          <p className="text-sm text-slate-500 mt-1">
            {items.length ? `${totalItems} producto(s) listos para continuar tu compra.` : "Tu carrito está vacío por ahora."}
          </p>
        </div>
        {items.length ? (
          <Button type="button" variant="secondary" onClick={clear}>
            Vaciar carrito
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
            Actualizando carrito...
          </div>
        </div>
      ) : null}

      {!items.length ? (
        <Card className="rounded-2xl shadow-[var(--shadow-card)]">
          <CardBody className="py-14">
            <div className="max-w-sm mx-auto text-center flex flex-col items-center gap-4">
              <div className="grid place-items-center h-16 w-16 rounded-2xl bg-slate-100 text-slate-400">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">Aún no agregaste productos</p>
                <p className="text-sm text-slate-500 mt-1">Explora el catálogo y agrega tus favoritos para finalizar tu compra.</p>
              </div>
              <Link href="/catalog" className="btn-brand inline-flex">
                Ver catálogo
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {items.length ? (
        <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
          <div className="flex flex-col gap-3">
            {lines.map(({ it, p, v, unit, subtotal }, i) => {
              const mainImage = p?.images?.find((img) => img?.isMain) ?? p?.images?.[0];
              const imageSrc = mainImage?.url ? String(mainImage.url) : "";

              return (
                <div key={`${it.productId}:${it.variantId}`} className={`rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-card)] p-4 flex flex-col sm:flex-row gap-4 fade-in-up`} style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="h-24 w-24 rounded-xl border border-slate-200 overflow-hidden bg-[var(--surface-muted)] shrink-0">
                    {imageSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageSrc} alt={p?.name ?? "Producto"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-[11px] text-slate-400">Sin imagen</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{p?.name ?? it.productId}</p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {v ? `${v.size ?? ""} ${v.color ?? ""}`.trim() || v.id : it.variantId}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className="text-slate-500">Unitario: {formatPEN(unit)}</span>
                      <span className="font-semibold text-slate-900">Subtotal: {formatPEN(subtotal)}</span>
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={it.qty}
                      onChange={(e) => setQty(it.productId, it.variantId, Number(e.target.value))}
                      className="w-20 text-center"
                      uiSize="sm"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(it.productId, it.variantId)} className="text-slate-500 hover:text-rose-600">
                      Quitar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-elevated)] p-5 flex flex-col gap-4 lg:sticky lg:top-24">
            <p className="text-lg font-bold text-slate-900">Resumen</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Productos</span>
              <span className="font-medium text-slate-900 tabular-nums">{totalItems}</span>
            </div>
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
              <span className="text-slate-500 text-sm">Total</span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">{formatPEN(total)}</span>
            </div>
            <p className="text-xs text-slate-500">El stock final se confirma al crear el pedido.</p>
            <Link href="/checkout" className="btn-brand justify-center">
              Continuar compra
            </Link>
            <Link href="/catalog" className="text-center text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
              Seguir comprando
            </Link>
          </div>
        </div>
      ) : null}

      {items.length ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
          <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Compra protegida: pedido registrado, validación de pago manual y seguimiento por número de pedido.
        </div>
      ) : null}
    </div>
  );
}
