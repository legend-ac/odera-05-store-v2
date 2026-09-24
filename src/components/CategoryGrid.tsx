"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type Category = {
  key: string;
  label: string;
  subtitle: string;
  cta: string;
  imageUrl?: string;
};

function categoryImage(category: Category, index: number): string {
  if (category.imageUrl) return category.imageUrl;
  if (category.key.includes("zapat")) return "/brand/category-zapatillas.jpg";
  if (category.key.includes("ropa")) return "/brand/category-ropa.jpg";
  if (category.key.includes("acces")) return "/brand/category-accesorios.jpg";
  return ["/brand/category-zapatillas.jpg", "/brand/category-ropa.jpg", "/brand/category-accesorios.jpg"][index % 3]!;
}

function CategoryCard({ category, index }: { category: Category; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/catalog?type=${encodeURIComponent(category.key)}`}
      className="group block relative overflow-hidden"
      style={{
        border: hovered ? "1px solid var(--vermeil)" : "1px solid var(--ash-2)",
        borderRadius: "2px",
        boxShadow: hovered ? "4px 4px 0 rgba(232,69,44,0.3)" : "none",
        transform: hovered ? "translate(-2px, -2px)" : "translate(0, 0)",
        transition: "border-color 200ms, box-shadow 200ms, transform 200ms",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={categoryImage(category, index)}
          alt={category.label}
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        {/* Dark overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(0deg, rgba(14,14,18,0.85) 0%, rgba(14,14,18,0.1) 60%)",
          }}
        />
        {/* Vermeil corner */}
        <div
          className="absolute top-0 right-0 transition-all duration-300"
          style={{
            width: hovered ? 56 : 40,
            height: hovered ? 56 : 40,
            background: "var(--vermeil)",
            clipPath: "polygon(100% 0, 100% 100%, 0 0)",
          }}
        />
      </div>

      {/* Info */}
      <div
        className="p-4 flex items-start justify-between gap-3"
        style={{
          background: "var(--ink-2)",
          borderTop: "1px solid var(--ash-2)",
        }}
      >
        <div>
          <h3
            className="font-black"
            style={{
              fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
              fontSize: "22px",
              letterSpacing: "0.08em",
              color: "var(--paper)",
            }}
          >
            {category.label}
          </h3>
          <p style={{ fontSize: "11px", color: "var(--ash)", marginTop: "2px" }}>
            {category.subtitle}
          </p>
        </div>
        <span
          className="font-black transition-transform duration-200 group-hover:translate-x-1"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "20px",
            color: "var(--vermeil)",
            lineHeight: 1,
            paddingTop: "4px",
          }}
        >
          →
        </span>
      </div>
    </Link>
  );
}

export default function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {categories.map((category, index) => (
        <CategoryCard key={category.key} category={category} index={index} />
      ))}
    </div>
  );
}
