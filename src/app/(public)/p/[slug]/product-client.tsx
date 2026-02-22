"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCart } from "@/components/cart/CartProvider";
import { formatPEN } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/fields";
import ProductCard, { type ProductCardData } from "@/components/ProductCard";

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
  const [showCartModal, setShowCartModal] = useState(false);
  const [addedQty, setAddedQty] = useState(1);
  const [recommended, setRecommended] = useState<ProductCardData[]>([]);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const q = query(collection(db, "products"), where("status", "==", "active"), limit(20));
        const snap = await getDocs(q);
        if (!mounted) return;
        const list = snap.docs
          .filter((d) => d.id !== slug)
          .slice(0, 3)
          .map((d) => {
            const product = d.data() as any;
            const imgs = Array.isArray(product.images) ? [...product.images] : [];
            const sorted = imgs.sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
            const imageUrls = sorted.map((x: any) => String(x?.url ?? "")).filter(Boolean);
            const mainUrl = sorted.find((x: any) => x?.isMain)?.url ?? imageUrls[0];
            return {
              id: d.id,
              name: String(product.name ?? ""),
              price: Number(product.price ?? 0),
              salePrice: typeof product.salePrice === "number" ? product.salePrice : undefined,
              onSale: Boolean(product.onSale),
              imageUrl: typeof mainUrl === "string" ? mainUrl : undefined,
              imageUrls,
            } satisfies ProductCardData;
          });
        setRecommended(list);
      } catch {
        setRecommended([]);
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
  const available = selectedVariant ? selectedVariant.stock : 0;
  const modalSubtotal = useMemo(() => unitPrice * addedQty, [unitPrice, addedQty]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="text-sm text-slate-500">Cargando producto...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="text-sm text-red-600">{error}</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-8 grid gap-6 lg:grid-cols-[1fr_460px]">
        <Card className="overflow-hidden">
          <CardBody className="p-0">
            <div className="aspect-square flex items-center justify-center overflow-hidden relative bg-slate-100">
              {mainImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mainImg}
                  alt={data.name ?? ""}
                  className="w-full h-full object-cover"
                  onError={() => setImgIndex((i) => (i + 1 < galleryUrls.length ? i + 1 : i))}
                />
              ) : (
                <div className="text-xs text-slate-500">Sin foto</div>
              )}

              {galleryUrls.length > 1 ? (
                <>
                  <button
                    type="button"
                    aria-label="Imagen anterior"
                    onClick={() => setImgIndex((i) => (i - 1 + galleryUrls.length) % galleryUrls.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/35 text-white hover:bg-black/55"
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    aria-label="Siguiente imagen"
                    onClick={() => setImgIndex((i) => (i + 1) % galleryUrls.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/35 text-white hover:bg-black/55"
                  >
                    &gt;
                  </button>
                </>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold">{String(data.name ?? "")}</h1>
              <div className="text-sm text-slate-600">{String(data.brand ?? "")}</div>
            </div>

            <div className="text-3xl font-bold">{formatPEN(unitPrice)}</div>

            <div className="text-sm text-slate-600 whitespace-pre-wrap">{String(data.description ?? "")}</div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold">Variante</label>
              <Select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.size ? `Talla ${v.size}` : ""} {v.color ? `Color ${v.color}` : ""} - Disponible: {v.stock}
                  </option>
                ))}
              </Select>

              <label className="text-sm font-semibold">Cantidad</label>
              <Input
                type="number"
                value={qty}
                min={1}
                max={Math.min(50, Math.max(1, available))}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-32"
              />

              <Button
                type="button"
                disabled={!variantId || available <= 0}
                onClick={() => {
                  const safeQty = Math.min(50, Math.max(1, Math.floor(qty || 1)));
                  addItem({ productId: data.id, variantId, qty: safeQty });
                  setAddedQty(safeQty);
                  setShowCartModal(true);
                }}
              >
                Agregar al carrito
              </Button>

              <div className="text-xs text-slate-500">La cantidad final se confirma al generar tu pedido.</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {showCartModal ? (
        <div className="fixed inset-0 z-[80] bg-black/55 px-4 py-6 overflow-y-auto">
          <div className="mx-auto max-w-3xl">
            <Card className="overflow-hidden">
              <CardBody className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Producto agregado</h2>
                    <p className="text-sm text-slate-600">Tu item ya esta en el carrito.</p>
                  </div>
                  <button
                    type="button"
                    className="h-9 w-9 rounded-full border border-slate-200 text-slate-500"
                    onClick={() => setShowCartModal(false)}
                  >
                    ×
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-[110px_1fr_auto] items-center rounded-xl border border-slate-200 p-3">
                  <div className="aspect-square rounded-lg bg-slate-100 overflow-hidden">
                    {mainImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mainImg} alt={String(data.name ?? "")} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{String(data.name ?? "")}</p>
                    <p className="text-sm text-slate-500">Variante: {selectedVariant?.size ? `Talla ${selectedVariant.size}` : selectedVariant?.id ?? "-"}</p>
                    <div className="mt-2 inline-flex items-center rounded-lg border border-slate-200">
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm"
                        onClick={() => setAddedQty((qv) => Math.max(1, qv - 1))}
                      >
                        -
                      </button>
                      <span className="px-3 py-1.5 text-sm border-x border-slate-200">{addedQty}</span>
                      <button
                        type="button"
                        className="px-3 py-1.5 text-sm"
                        onClick={() => setAddedQty((qv) => Math.min(50, qv + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Subtotal</p>
                    <p className="text-xl font-bold">{formatPEN(modalSubtotal)}</p>
                  </div>
                </div>

                {recommended.length ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-semibold text-slate-900">Recomendados para ti</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {recommended.map((it) => (
                        <ProductCard key={it.id} p={it} />
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                  <Button type="button" variant="secondary" onClick={() => setShowCartModal(false)}>
                    Seguir comprando
                  </Button>
                  <Link href="/cart" className="btn-brand text-center">
                    Ir al carrito
                  </Link>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
