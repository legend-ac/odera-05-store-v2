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
import type { ProductCardData } from "@/components/ProductCard";

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
  const [showSpecs, setShowSpecs] = useState(false);
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
  const specsText = useMemo(() => String(data?.description ?? "").trim(), [data?.description]);

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
      <div className="mx-auto grid max-w-6xl gap-3 px-2.5 py-3 sm:gap-6 sm:px-4 sm:py-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,440px)] lg:py-8">
        <Card className="overflow-hidden">
          <CardBody className="p-0">
            <div className="relative flex h-[56vh] min-h-[220px] max-h-[360px] items-center justify-center overflow-hidden bg-slate-100 sm:h-[62vh] sm:max-h-[500px] lg:h-[68vh] lg:max-h-[560px]">
              {mainImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mainImg}
                  alt={data.name ?? ""}
                  className="h-auto max-h-full w-auto max-w-full object-contain p-1.5 sm:p-3"
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
                    className="absolute left-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-black/35 text-white hover:bg-black/55 sm:h-10 sm:w-10"
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    aria-label="Siguiente imagen"
                    onClick={() => setImgIndex((i) => (i + 1) % galleryUrls.length)}
                    className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-black/35 text-white hover:bg-black/55 sm:h-10 sm:w-10"
                  >
                    &gt;
                  </button>
                </>
              ) : null}
            </div>

            {galleryUrls.length > 1 ? (
              <div className="grid grid-cols-4 gap-2 border-t border-slate-200 bg-white p-3 sm:grid-cols-5">
                {galleryUrls.slice(0, 10).map((url, i) => (
                  <button
                    key={`${url}-${i}`}
                    type="button"
                    onClick={() => setImgIndex(i)}
                    className={[
                      "aspect-square overflow-hidden rounded-lg border transition",
                      i === imgIndex ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200 hover:border-slate-300",
                    ].join(" ")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`${data.name ?? ""} ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card className="lg:sticky lg:top-24 lg:self-start">
          <CardBody className="flex flex-col gap-3.5 p-3.5 sm:gap-5 sm:p-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-[clamp(1.62rem,6.2vw,3rem)] font-bold leading-[1.05] tracking-[-0.01em]">{String(data.name ?? "")}</h1>
              <div className="text-sm text-slate-600">{String(data.brand ?? "")}</div>
            </div>

            <div className="text-[1.85rem] font-bold leading-none sm:text-4xl">{formatPEN(unitPrice)}</div>

            {specsText ? (
              <div className="rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setShowSpecs((v) => !v)}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left sm:px-4 sm:py-3"
                >
                  <span className="text-sm font-semibold text-slate-900">Especificaciones</span>
                  <span className="text-xs font-medium text-slate-600">{showSpecs ? "Ocultar" : "Ver"}</span>
                </button>
                {showSpecs ? (
                  <div className="border-t border-slate-200 px-3.5 pb-3.5 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{specsText}</div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Compra protegida</p>
                <p className="mt-1 text-[13px] font-medium leading-snug text-slate-900 sm:text-sm sm:leading-normal">Pago validado por el equipo</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Seguimiento</p>
                <p className="mt-1 text-[13px] font-medium leading-snug text-slate-900 sm:text-sm sm:leading-normal">Estado del pedido en tiempo real</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold">Variante</label>
              <Select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.size ? `Talla ${v.size}` : ""} {v.color ? `Color ${v.color}` : ""} - Disponible: {v.stock}
                  </option>
                ))}
              </Select>

              <div className="sm:hidden">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white">
                    <button
                      type="button"
                      className="h-11 w-10 text-lg leading-none text-slate-700"
                      onClick={() => setQty((qv) => Math.max(1, qv - 1))}
                      aria-label="Disminuir cantidad"
                    >
                      -
                    </button>
                    <span className="inline-flex h-11 min-w-[44px] items-center justify-center border-x border-slate-200 text-base font-semibold text-slate-900">
                      {Math.min(50, Math.max(1, Math.floor(qty || 1)))}
                    </span>
                    <button
                      type="button"
                      className="h-11 w-10 text-lg leading-none text-slate-700"
                      onClick={() => setQty((qv) => Math.min(Math.min(50, Math.max(1, available)), qv + 1))}
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={!variantId || available <= 0}
                    onClick={() => {
                      const safeQty = Math.min(50, Math.max(1, Math.floor(qty || 1)));
                      addItem({ productId: data.id, variantId, qty: safeQty });
                      setAddedQty(safeQty);
                      setShowCartModal(true);
                    }}
                    className="h-11 flex-1 rounded-xl bg-slate-800 px-4 text-base font-semibold text-white disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
                <div className="mt-1 text-xs text-slate-500">Maximo {Math.min(50, Math.max(1, available))} unidades.</div>
              </div>

              <div className="hidden sm:block">
                <label className="text-sm font-semibold">Cantidad</label>
                <Input
                  type="number"
                  value={qty}
                  min={1}
                  max={Math.min(50, Math.max(1, available))}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="mt-1 w-32"
                />
              </div>

              <Button
                type="button"
                disabled={!variantId || available <= 0}
                onClick={() => {
                  const safeQty = Math.min(50, Math.max(1, Math.floor(qty || 1)));
                  addItem({ productId: data.id, variantId, qty: safeQty });
                  setAddedQty(safeQty);
                  setShowCartModal(true);
                }}
                className="hidden sm:inline-flex"
              >
                Agregar al carrito
              </Button>

              <div className="text-xs text-slate-500">La cantidad final se confirma al generar tu pedido.</div>
            </div>
          </CardBody>
        </Card>
      </div>

      {showCartModal ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-2.5 sm:items-center sm:p-6">
          <div className="w-full max-w-[390px] sm:max-w-4xl">
            <Card className="max-h-[90dvh] overflow-hidden rounded-2xl sm:max-h-[92vh]">
              <CardBody className="flex min-h-0 flex-col gap-3 p-3.5 sm:gap-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[1.45rem] font-bold leading-tight text-slate-900 sm:text-xl sm:leading-normal">Producto agregado</h2>
                    <p className="mt-1 text-sm leading-snug text-slate-600 sm:mt-0 sm:text-sm sm:leading-normal">Tu producto ya está en el carrito.</p>
                  </div>
                  <button
                    type="button"
                    className="h-9 w-9 rounded-full border border-slate-200 text-slate-500"
                    onClick={() => setShowCartModal(false)}
                  >
                    &times;
                  </button>
                </div>

                <div className="min-h-0 space-y-3 overflow-y-auto pr-0.5">
                  <div className="grid grid-cols-[76px_1fr] items-start gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[96px_1fr_auto] sm:items-center">
                    <div className="aspect-square w-full max-w-[76px] overflow-hidden rounded-lg bg-slate-100 sm:max-w-[112px]">
                      {mainImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={mainImg} alt={String(data.name ?? "")} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[1.06rem] font-semibold leading-tight text-slate-900 sm:text-base sm:leading-normal">{String(data.name ?? "")}</p>
                      <p className="mt-1 text-sm leading-tight text-slate-500 sm:mt-0 sm:text-sm sm:leading-normal">Variante: {selectedVariant?.size ? `Talla ${selectedVariant.size}` : selectedVariant?.id ?? "-"}</p>
                      <div className="mt-2 inline-flex items-center rounded-lg border border-slate-200">
                        <button
                          type="button"
                          className="h-9 px-3 text-sm"
                          onClick={() => setAddedQty((qv) => Math.max(1, qv - 1))}
                        >
                          -
                        </button>
                        <span className="inline-flex h-9 items-center border-x border-slate-200 px-3 text-sm">{addedQty}</span>
                        <button
                          type="button"
                          className="h-9 px-3 text-sm"
                          onClick={() => setAddedQty((qv) => Math.min(50, qv + 1))}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-end justify-between border-t border-slate-200 pt-2 sm:col-span-1 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
                      <p className="text-xs text-slate-500 sm:text-xs">Subtotal</p>
                      <p className="text-[1.85rem] font-bold leading-none tracking-[-0.01em] sm:text-2xl">{formatPEN(modalSubtotal)}</p>
                    </div>
                  </div>

                  {recommended.length ? (
                    <div className="flex flex-col gap-3">
                      <p className="text-[1.06rem] font-semibold leading-tight text-slate-900 sm:text-sm sm:leading-normal">Recomendados para ti</p>
                      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:gap-2.5 sm:overflow-visible">
                        {recommended.map((it) => {
                          const price = it.onSale && typeof it.salePrice === "number" ? it.salePrice : it.price;
                          const img = it.imageUrl || it.imageUrls?.[0] || "";
                          return (
                            <Link
                              key={it.id}
                              href={`/p/${it.id}`}
                              className="w-[138px] shrink-0 snap-start rounded-xl border border-slate-200 bg-white p-2 hover:border-slate-300 sm:w-auto sm:p-2.5"
                            >
                              <div className="aspect-[3/2] overflow-hidden rounded-lg bg-slate-100 sm:aspect-[4/3]">
                                {img ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={img} alt={it.name} className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                              <p className="mt-2 line-clamp-2 text-xs font-semibold leading-tight text-slate-900 sm:min-h-[2rem] sm:text-sm">{it.name}</p>
                              <p className="mt-1 text-[1.02rem] font-bold leading-tight text-slate-900 sm:text-sm sm:leading-normal">{formatPEN(price)}</p>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="sticky bottom-0 z-10 -mx-3.5 mt-1 flex flex-col gap-2 border-t border-slate-200 bg-white px-3.5 pt-2.5 pb-[max(0.8rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0">
                  <Button type="button" variant="secondary" onClick={() => setShowCartModal(false)} className="w-full sm:w-auto">
                    Seguir comprando
                  </Button>
                  <Link href="/cart" className="btn-brand w-full text-center sm:w-auto">
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
