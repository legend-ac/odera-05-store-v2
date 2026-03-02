"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPEN } from "@/lib/money";

export type ProductCardData = {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  onSale: boolean;
  imageUrl?: string;
  imageUrls?: string[];
};

export default function ProductCard({ p }: { p: ProductCardData }) {
  const price = p.onSale && typeof p.salePrice === "number" ? p.salePrice : p.price;
  const hasDiscount = p.onSale && typeof p.salePrice === "number";
  const discountPct =
    hasDiscount && p.price > 0
      ? Math.round(((p.price - (p.salePrice as number)) / p.price) * 100)
      : 0;
  const candidates = useMemo(() => {
    const list = [p.imageUrl, ...(p.imageUrls ?? [])].filter(
      (x): x is string => Boolean(x && x.trim())
    );
    return Array.from(new Set(list));
  }, [p.imageUrl, p.imageUrls]);
  const [idx, setIdx] = useState(0);
  const current = candidates[idx] ?? "";

  return (
    <Link
      href={`/p/${p.id}`}
      className="group fade-in-up overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-all duration-300 hover:-translate-y-2 hover:border-slate-300/60 hover:shadow-[0_24px_48px_rgba(15,23,42,0.16)]"
    >
      {/* ── Imagen cuadrada 1:1 ── ideal 1280×1280 px ── */}
      <div className="relative aspect-square bg-[#f5f5f7] overflow-hidden">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current}
            alt={p.name}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500 ease-out"
            onError={() => setIdx((i) => (i + 1 < candidates.length ? i + 1 : i))}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/brand/placeholder-product.svg"
            alt="Producto sin imagen ODERA 05"
            className="w-full h-full object-contain p-6 opacity-30"
          />
        )}

        {/* Badges de descuento */}
        {hasDiscount ? (
          <div className="absolute left-2.5 top-2.5 flex gap-1.5">
            <span className="inline-flex items-center rounded-full bg-[var(--sale)] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
              Oferta
            </span>
            <span className="inline-flex items-center rounded-full bg-black/70 backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-bold text-white">
              -{discountPct}%
            </span>
          </div>
        ) : null}
      </div>

      {/* ── Info ── */}
      <div className="p-3.5 space-y-2">
        <div className="text-sm font-semibold leading-snug min-h-[2.4rem] text-slate-900 overflow-hidden group-hover:text-[var(--brand-700)] transition-colors duration-200 line-clamp-2">
          {p.name}
        </div>
        <div className="flex items-end gap-2">
          <span className="text-lg font-black text-slate-900">{formatPEN(price)}</span>
          {hasDiscount ? (
            <span className="text-xs text-slate-400 line-through pb-0.5">
              {formatPEN(p.price)}
            </span>
          ) : null}
        </div>
        <div className="pt-0.5">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-slate-600 group-hover:border-[var(--brand-400)] group-hover:text-[var(--brand-700)] group-hover:bg-[var(--brand-50)] transition-all duration-200">
            Ver detalle
            <svg
              className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
