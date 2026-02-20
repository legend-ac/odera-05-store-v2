"use client";

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

  return (
    <Link
      href={`/p/${p.id}`}
      className="group panel overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(15,23,42,0.10)]"
    >
      <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden relative">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        ) : (
          <div className="text-xs text-slate-500">Sin imagen</div>
        )}

        {p.onSale && typeof p.salePrice === "number" ? (
          <span className="absolute top-2 left-2 text-[11px] px-2 py-1 rounded-md bg-emerald-600 text-white">Oferta</span>
        ) : null}
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div className="text-sm font-semibold truncate text-slate-900">{p.name}</div>
        <div className="text-sm">
          <span className="font-semibold text-slate-900">{formatPEN(price)}</span>
          {p.onSale && typeof p.salePrice === "number" ? (
            <span className="text-xs text-slate-500 ml-2 line-through">{formatPEN(p.price)}</span>
          ) : null}
        </div>
        <span className="text-[11px] text-slate-500">Ver detalle y variantes</span>
      </div>
    </Link>
  );
}
