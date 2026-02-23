"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPEN } from "@/lib/money";
import { Badge } from "@/components/ui/badge";

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
  const discountPct = hasDiscount && p.price > 0 ? Math.round(((p.price - (p.salePrice as number)) / p.price) * 100) : 0;
  const candidates = useMemo(() => {
    const list = [p.imageUrl, ...(p.imageUrls ?? [])].filter((x): x is string => Boolean(x && x.trim()));
    return Array.from(new Set(list));
  }, [p.imageUrl, p.imageUrls]);
  const [idx, setIdx] = useState(0);
  const current = candidates[idx] ?? "";

  return (
    <Link
      href={`/p/${p.id}`}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.14)]"
    >
      <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current}
            alt={p.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setIdx((i) => (i + 1 < candidates.length ? i + 1 : i))}
          />
        ) : (
          <div className="h-full w-full grid place-items-center text-xs text-slate-500">Sin imagen</div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 via-black/0 to-transparent pointer-events-none" />

        {hasDiscount ? (
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge tone="sale">Oferta</Badge>
            <Badge tone="default">-{discountPct}%</Badge>
          </div>
        ) : null}
      </div>

      <div className="p-4 space-y-2">
        <div className="text-sm font-semibold leading-snug min-h-[2.6rem] text-slate-900 overflow-hidden">{p.name}</div>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-lg font-bold text-slate-900">{formatPEN(price)}</span>
          {hasDiscount ? (
            <span className="text-xs text-slate-400 line-through">{formatPEN(p.price)}</span>
          ) : null}
        </div>
        <div className="pt-2">
          <span className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 group-hover:border-slate-300 group-hover:text-slate-800">
            Ver detalle y variantes
          </span>
        </div>
      </div>
    </Link>
  );
}
