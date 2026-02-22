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
  const candidates = useMemo(() => {
    const list = [p.imageUrl, ...(p.imageUrls ?? [])].filter((x): x is string => Boolean(x && x.trim()));
    return Array.from(new Set(list));
  }, [p.imageUrl, p.imageUrls]);
  const [idx, setIdx] = useState(0);
  const current = candidates[idx] ?? "";

  return (
    <Link
      href={`/p/${p.id}`}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
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

        {p.onSale && typeof p.salePrice === "number" ? (
          <div className="absolute left-3 top-3">
            <Badge tone="sale">Oferta</Badge>
          </div>
        ) : null}
      </div>

      <div className="p-4">
        <div className="text-sm font-semibold truncate text-slate-900">{p.name}</div>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-lg font-bold text-slate-900">{formatPEN(price)}</span>
          {p.onSale && typeof p.salePrice === "number" ? (
            <span className="text-xs text-slate-400 line-through">{formatPEN(p.price)}</span>
          ) : null}
        </div>
        <div className="mt-3 text-xs font-medium text-slate-500 group-hover:text-slate-700">
          Ver detalle y variantes
        </div>
      </div>
    </Link>
  );
}
