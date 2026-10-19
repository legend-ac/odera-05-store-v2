"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { productImageDelivery } from "@/lib/image";

export function useProductImages(sources: Array<string | undefined>, productId = "") {
  const urls = Array.from(new Set(sources.map((url) => url?.trim()).filter((url): url is string => Boolean(url))));
  const sourceKey = JSON.stringify([productId, urls]);
  const initial = { sourceKey, failed: [] as string[], selected: urls[0] ?? "" };
  const [saved, setSaved] = useState(initial);
  // Reset immediately when a reused card or product receives different URLs,
  // including a replacement with the same number of photos.
  const state = saved.sourceKey === sourceKey ? saved : initial;
  const availableUrls = urls.filter((url) => !state.failed.includes(url));
  const current = availableUrls.includes(state.selected) ? state.selected : availableUrls[0] ?? "";

  function reportFailure(url: string) {
    setSaved((previous) => {
      const active = previous.sourceKey === sourceKey ? previous : initial;
      if (!urls.includes(url) || active.failed.includes(url)) return active;
      return { ...active, failed: [...active.failed, url] };
    });
  }

  function select(url: string) {
    if (!availableUrls.includes(url)) return;
    setSaved((previous) => ({ ...(previous.sourceKey === sourceKey ? previous : initial), selected: url }));
  }

  function step(direction: -1 | 1) {
    if (!availableUrls.length) return;
    const index = availableUrls.indexOf(current);
    select(availableUrls[(index + direction + availableUrls.length) % availableUrls.length]!);
  }

  return { current, availableUrls, reportFailure, select, previous: () => step(-1), next: () => step(1) };
}

export function ProductImagePlaceholder({ name, compact = false }: { name: string; compact?: boolean }) {
  return (
    <div
      role="img"
      aria-label={`Imagen no disponible de ${name || "este producto"}`}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-1 text-center"
      style={{ color: "var(--ash)", background: "var(--ink-3)" }}
    >
      <svg aria-hidden="true" width={compact ? 22 : 38} height={compact ? 22 : 38} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span aria-hidden="true" style={{ fontSize: compact ? 10 : 12, lineHeight: 1.35 }}>Imagen no disponible</span>
    </div>
  );
}

type ProductImageProps = Omit<ImageProps, "src" | "onError"> & {
  sources: Array<string | undefined>;
  productId?: string;
  imageWidth?: number;
  compact?: boolean;
};

export default function ProductImage({ sources, productId, imageWidth = 900, compact = false, alt, ...props }: ProductImageProps) {
  const { current, reportFailure } = useProductImages(sources, productId);
  if (!current) return <ProductImagePlaceholder name={alt} compact={compact} />;

  return <Image {...props} {...productImageDelivery(current, imageWidth)} key={current} alt={alt} decoding="async" onError={() => reportFailure(current)} />;
}
