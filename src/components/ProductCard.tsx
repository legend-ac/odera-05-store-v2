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
  const [hovered, setHovered] = useState(false);
  const current = candidates[idx] ?? "";
  const imageSrc = optimizedProductImage(current, 600);

  return (
    <Link
      href={`/p/${p.id}`}
      className="group flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--ink-2)",
        border: hovered ? "1px solid var(--vermeil)" : "1px solid var(--ash-2)",
        borderRadius: "2px",
        boxShadow: hovered ? "3px 3px 0 rgba(232,69,44,0.35)" : "none",
        transform: hovered ? "translate(-1px,-1px)" : "translate(0,0)",
        transition: "border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease",
        overflow: "hidden",
      }}
    >
      {/* ── Imagen ── */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          /* aspect-square: ideal para zapatillas/ropa ya que muestra el producto entero */
          aspectRatio: "1 / 1",
          background: "var(--ink-3)",
          flexShrink: 0,
        }}
      >
        {current ? (
          <Image
            src={imageSrc}
            alt={p.name}
            fill
            unoptimized
            {...(priority ? { priority: true } : { loading: "lazy" as const })}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain transition-transform duration-400 ease-out group-hover:scale-[1.05]"
            style={{ padding: "8px" }}
            onError={() => setIdx((i) => (i + 1 < candidates.length ? i + 1 : i))}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              className="h-10 w-10"
              style={{ color: "var(--ash-2)" }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Badge descuento */}
        {hasDiscount && (
          <div className="absolute left-0 top-0 z-10">
            <span
              className="inline-flex items-center font-black text-white leading-none"
              style={{
                background: "var(--vermeil)",
                fontSize: "10px",
                letterSpacing: "0.06em",
                padding: "4px 8px",
              }}
            >
              -{discountPct}%
            </span>
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div
        className="flex flex-col"
        style={{
          padding: "10px 12px 12px",
          borderTop: "1px solid var(--ash-2)",
          minHeight: "80px",
          gap: "6px",
        }}
      >
        {/* Nombre */}
        <p
          className="font-semibold leading-snug line-clamp-2"
          style={{
            fontSize: "12px",
            color: "var(--paper)",
            flex: 1,
          }}
        >
          {p.name}
        </p>

        {/* Precio + CTA */}
        <div className="flex items-end justify-between gap-2 mt-auto">
          <div className="flex flex-col gap-0.5">
            <span
              className="font-black leading-none tabular-nums"
              style={{
                fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
                fontSize: "18px",
                color: hasDiscount ? "var(--vermeil)" : "var(--paper)",
                letterSpacing: "0.04em",
              }}
            >
              {formatPEN(price)}
            </span>
            {hasDiscount && (
              <span
                className="line-through tabular-nums leading-none"
                style={{ fontSize: "10px", color: "var(--ash)" }}
              >
                {formatPEN(p.price)}
              </span>
            )}
          </div>

          {/* Flecha CTA */}
          <span
            className="shrink-0 flex items-center justify-center transition-all duration-180"
            style={{
              height: 26,
              width: 26,
              border: "1px solid",
              borderColor: hovered ? "var(--vermeil)" : "var(--ash-2)",
              background: hovered ? "var(--vermeil)" : "transparent",
              borderRadius: "1px",
              color: hovered ? "#fff" : "var(--ash)",
            }}
          >
            <svg
              className="h-3 w-3 transition-transform duration-180 group-hover:translate-x-0.5"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
