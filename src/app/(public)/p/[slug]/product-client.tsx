"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCart } from "@/components/cart/CartProvider";
import { formatPEN } from "@/lib/money";

type Variant = { id: string; size?: string; color?: string; sku?: string; stock: number };
type Img = { url: string; alt?: string; isMain: boolean; order: number };

export default function ProductClient({ slug }: { slug: string }) {
  const { addItem } = useCart();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);

  const [variantId, setVariantId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const snap = await getDoc(doc(db, "products", slug));
        if (!snap.exists()) {
          if (mounted) setError("Producto no disponible.");
          return;
        }
        const d = snap.data();
        if (mounted) setData({ id: snap.id, ...d });
        const variants = Array.isArray(d.variants) ? (d.variants as Variant[]) : [];
        if (variants[0]?.id && mounted) setVariantId(String(variants[0].id));
      } catch (e) {
        console.error(e);
        if (mounted) setError("No pudimos cargar este producto.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [slug]);

  const variants: Variant[] = useMemo(() => (data?.variants && Array.isArray(data.variants) ? (data.variants as Variant[]) : []), [data]);
  const images: Img[] = useMemo(() => (data?.images && Array.isArray(data.images) ? (data.images as Img[]) : []), [data]);

  const selectedVariant = useMemo(() => variants.find((v) => v.id === variantId) ?? null, [variants, variantId]);

  const unitPrice = useMemo(() => {
    if (!data) return 0;
    const onSale = Boolean(data.onSale);
    const salePrice = typeof data.salePrice === "number" ? data.salePrice : undefined;
    const price = typeof data.price === "number" ? data.price : 0;
    return onSale && typeof salePrice === "number" ? salePrice : price;
  }, [data]);

  const galleryUrls = useMemo(() => {
    const sorted = [...images].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const urls = sorted.map((x) => x.url).filter(Boolean);
    if (!urls.length) return [];
    const main = sorted.find((x) => x.isMain)?.url;
    if (!main) return urls;
    const i = urls.indexOf(main);
    if (i <= 0) return urls;
    return [main, ...urls.slice(0, i), ...urls.slice(i + 1)];
  }, [images]);

  useEffect(() => {
    setImgIndex(0);
  }, [slug, galleryUrls.length]);

  const mainImg = galleryUrls[imgIndex] ?? "";

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="text-sm text-neutral-500">Cargando producto...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }
  if (!data) return null;

  const available = selectedVariant ? selectedVariant.stock : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 grid md:grid-cols-2 gap-6">
      <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-neutral-50">
        <div className="aspect-square flex items-center justify-center overflow-hidden relative">
          {mainImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mainImg}
              alt={data.name ?? ""}
              className="w-full h-full object-cover"
              onError={() => setImgIndex((i) => (i + 1 < galleryUrls.length ? i + 1 : i))}
            />
          ) : (
            <div className="text-xs text-neutral-500">Sin foto</div>
          )}

          {galleryUrls.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Imagen anterior"
                onClick={() => setImgIndex((i) => (i - 1 + galleryUrls.length) % galleryUrls.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/35 text-white hover:bg-black/55"
              >
                &lt;
              </button>
              <button
                type="button"
                aria-label="Siguiente imagen"
                onClick={() => setImgIndex((i) => (i + 1) % galleryUrls.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/35 text-white hover:bg-black/55"
              >
                &gt;
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{String(data.name ?? "")}</h1>
          <div className="text-sm text-neutral-600">{String(data.brand ?? "")}</div>
        </div>

        <div className="text-lg font-semibold">{formatPEN(unitPrice)}</div>

        <div className="text-sm text-neutral-700 whitespace-pre-wrap">{String(data.description ?? "")}</div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Variante</label>
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.size ? `Talla ${v.size}` : ""} {v.color ? `Color ${v.color}` : ""} - Disponible: {v.stock}
              </option>
            ))}
          </select>

          <label className="text-sm font-medium">Cantidad</label>
          <input
            type="number"
            value={qty}
            min={1}
            max={Math.min(50, Math.max(1, available))}
            onChange={(e) => setQty(Number(e.target.value))}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm w-32"
          />

          <button
            type="button"
            disabled={!variantId || available <= 0}
            onClick={() => {
              const safeQty = Math.min(50, Math.max(1, Math.floor(qty || 1)));
              addItem({ productId: data.id, variantId, qty: safeQty });
              alert("Producto agregado al carrito");
            }}
            className="px-4 py-2 rounded-md bg-black text-white text-sm disabled:opacity-50"
          >
            Agregar al carrito
          </button>

          <div className="text-xs text-neutral-500">
            La cantidad final se confirma al momento de generar tu pedido.
          </div>
        </div>
      </div>
    </div>
  );
}
