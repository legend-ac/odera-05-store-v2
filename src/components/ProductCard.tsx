"use client";

import Link from "next/link";
import { formatPEN } from "@/lib/money";
import ProductImage from "@/components/ProductImage";
import styles from "./ProductCard.module.css";

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

  return (
    <Link href={`/p/${p.id}`} className={styles.card}>
      <div className={styles.image}>
        <ProductImage
          sources={[p.imageUrl, ...(p.imageUrls ?? [])]}
          productId={p.id}
          imageWidth={600}
          alt={p.name}
          fill
          unoptimized
          {...(priority ? { priority: true } : { loading: "lazy" as const })}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={styles.photo}
        />
        {hasDiscount && <span className={styles.discount}>−{discountPct}%</span>}
      </div>
      <div className={styles.info}>
        <p className={styles.name}>{p.name}</p>
        <div className={styles.bottom}>
          <div className={styles.prices}>
            <span className={`${styles.price} ${hasDiscount ? styles.sale : ""}`}>{formatPEN(price)}</span>
            {hasDiscount && <span className={styles.original}>{formatPEN(p.price)}</span>}
          </div>
          <span className={styles.arrow} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
