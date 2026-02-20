"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCart } from "@/components/cart/CartProvider";
import { formatPEN } from "@/lib/money";

type ProductData = {
  id: string;
  name: string;
  price: number;
  salePrice?: number;
  onSale: boolean;
  images?: { url: string; isMain: boolean }[];
  variants: { id: string; size?: string; color?: string; stock: number }[];
};

export default function CartPage() {
  const { items, removeItem, setQty, clear } = useCart();
  const [products, setProducts] = useState<Record<string, ProductData>>({});
  const [loading, setLoading] = useState(false);

  const uniqueProductIds = useMemo(() => Array.from(new Set(items.map((x) => x.productId))), [items]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const map: Record<string, ProductData> = {};
        for (const id of uniqueProductIds) {
          const snap = await getDoc(doc(db, "products", id));
          if (!snap.exists()) continue;
          const d = snap.data() as any;
          map[id] = {
            id,
            name: String(d.name ?? ""),
            price: Number(d.price ?? 0),
            salePrice: typeof d.salePrice === "number" ? d.salePrice : undefined,
            onSale: Boolean(d.onSale),
            images: Array.isArray(d.images) ? d.images : [],
            variants: Array.isArray(d.variants) ? d.variants : [],
          };
        }
        if (mounted) setProducts(map);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [uniqueProductIds]);

  const lines = useMemo(() => {
    return items.map((it) => {
      const p = products[it.productId];
      const v = p?.variants?.find((x) => x.id === it.variantId);
      const unit = p ? (p.onSale && typeof p.salePrice === "number" ? p.salePrice : p.price) : 0;
      const subtotal = unit * it.qty;
      return { it, p, v, unit, subtotal };
    });
  }, [items, products]);

  const total = useMemo(() => lines.reduce((acc, x) => acc + x.subtotal, 0), [lines]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Carrito</h1>
        <button
          type="button"
          onClick={clear}
          className="text-sm px-3 py-2 rounded-md border border-neutral-300"
          disabled={!items.length}
        >
          Vaciar carrito
        </button>
      </div>

      {loading ? <div className="text-sm text-neutral-500">Actualizando carrito...</div> : null}

      {!items.length ? (
        <div className="text-sm text-neutral-600">
          Tu carrito esta vacio. <Link href="/catalog" className="underline">Ir al catalogo</Link>
        </div>
      ) : null}

      {items.length ? (
        <div className="flex flex-col gap-3">
          {lines.map(({ it, p, v, unit, subtotal }) => (
            <div key={`${it.productId}:${it.variantId}`} className="border border-neutral-200 rounded-xl p-4 flex gap-4">
              <div className="flex-1">
                <div className="font-medium">{p?.name ?? it.productId}</div>
                <div className="text-sm text-neutral-600">
                  Variante: {v ? `${v.size ?? ""} ${v.color ?? ""}`.trim() || v.id : it.variantId}
                </div>
                <div className="text-sm">Precio: {formatPEN(unit)}</div>
                <div className="text-sm">Subtotal: {formatPEN(subtotal)}</div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={it.qty}
                  onChange={(e) => setQty(it.productId, it.variantId, Number(e.target.value))}
                  className="border border-neutral-300 rounded-md px-2 py-1 text-sm w-20 text-right"
                />
                <button
                  type="button"
                  onClick={() => removeItem(it.productId, it.variantId)}
                  className="text-sm px-3 py-2 rounded-md border border-neutral-300"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {items.length ? (
        <div className="border border-neutral-200 rounded-xl p-4 flex items-center justify-between">
          <div className="text-sm text-neutral-600">Total</div>
          <div className="text-lg font-semibold">{formatPEN(total)}</div>
        </div>
      ) : null}

      {items.length ? (
        <div className="flex justify-end">
          <Link href="/checkout" className="px-4 py-2 rounded-md bg-black text-white text-sm">
            Continuar compra
          </Link>
        </div>
      ) : null}
    </div>
  );
}
