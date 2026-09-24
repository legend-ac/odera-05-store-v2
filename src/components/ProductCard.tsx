"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPEN } from "@/lib/money";
import { optimizedProductImage } from "@/lib/image";

export type ProductCardData = {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  onSale: boolean;
  imageUrl?: string;
  imageUrls?: string[];
};

export default function ProductCard({ p, priority = false }: { p: ProductCardData; priority?: boolean }) {
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
  const imageSrc = optimizedProductImage(current, 520);

  return (
    <Link
      href={`/p/${p.id}`}
      className="group flex flex-col bg-white"
    >
      {/* ── Imagen ── */}
      <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100">
        {current ? (
          <Image
            src={imageSrc}
            alt={p.name}
            fill
            unoptimized
            {...(priority ? { priority: true } : { loading: "lazy" as const })}
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            onError={() => setIdx((i) => (i + 1 < candidates.length ? i + 1 : i))}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badge % descuento — esquina superior izquierda */}
        {hasDiscount && (
          <div className="absolute left-0 top-0">
            <span className="inline-flex items-center bg-zinc-950 px-2 py-1.5 text-[10px] font-bold text-white leading-none">
              -{discountPct}%
            </span>
          </div>
        )}

        {/* Overlay oscuro al hacer hover para dar efecto de enfoque */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.03] transition-colors duration-300 pointer-events-none" />
      </div>

      {/* ── Info del producto ── */}
      <div className="flex flex-col flex-1 py-3 gap-2">

        {/* Nombre */}
        <p className="text-[13px] sm:text-sm font-semibold leading-snug text-zinc-900 line-clamp-2" style={{ minHeight: "2.6rem" }}>
          {p.name}
        </p>

        {/* Precio */}
        <div className="flex items-end justify-between gap-1.5 mt-auto">
          <div className="flex flex-col gap-0.5">
            {/* Precio principal */}
            <span className="text-[17px] sm:text-lg font-bold leading-none tabular-nums text-zinc-950">
              {formatPEN(price)}
            </span>
            {/* Precio original tachado */}
            {hasDiscount && (
              <span className="text-[11px] text-slate-400 line-through tabular-nums leading-none">
                {formatPEN(p.price)}
              </span>
            )}
          </div>

          {/* CTA — icono de ver */}
          <span className="shrink-0 flex items-center justify-center h-7 w-7 border border-zinc-300 text-zinc-700 group-hover:border-zinc-950 group-hover:bg-zinc-950 group-hover:text-white transition-colors">
            <svg className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>

      </div>
    </Link>
  );
}
