"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/types/cart";

type CartContextValue = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variantId: string) => void;
  setQty: (productId: string, variantId: string, qty: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "odera_cart_v1";

function normalizeQty(qty: number): number {
  if (!Number.isFinite(qty)) return 1;
  const n = Math.floor(qty);
  if (n < 1) return 1;
  if (n > 50) return 50;
  return n;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const safe: CartItem[] = parsed
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          const obj = x as Record<string, unknown>;
          const productId = typeof obj.productId === "string" ? obj.productId : "";
          const variantId = typeof obj.variantId === "string" ? obj.variantId : "";
          const qty = typeof obj.qty === "number" ? obj.qty : 1;
          if (!productId || !variantId) return null;
          return { productId, variantId, qty: normalizeQty(qty) };
        })
        .filter((x): x is CartItem => Boolean(x));
      setItems(safe);
    } catch (e) {
      console.warn("Failed to load cart", e);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to persist cart", e);
    }
  }, [items, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      addItem: (item) => {
        setItems((prev) => {
          const next = [...prev];
          const idx = next.findIndex((x) => x.productId === item.productId && x.variantId === item.variantId);
          if (idx >= 0) {
            const existing = next[idx]!;
            next[idx] = { ...existing, qty: normalizeQty(existing.qty + item.qty) };
            return next;
          }
          next.push({ ...item, qty: normalizeQty(item.qty) });
          return next;
        });
      },
      removeItem: (productId, variantId) => {
        setItems((prev) => prev.filter((x) => !(x.productId === productId && x.variantId === variantId)));
      },
      setQty: (productId, variantId, qty) => {
        setItems((prev) =>
          prev.map((x) => {
            if (x.productId === productId && x.variantId === variantId) {
              return { ...x, qty: normalizeQty(qty) };
            }
            return x;
          })
        );
      },
      clear: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
