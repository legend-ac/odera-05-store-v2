"use client";

import { useEffect } from "react";
import { initAppCheckIfConfigured } from "@/lib/firebase/appCheck";
import { CartProvider } from "@/components/cart/CartProvider";
import { Toaster } from "react-hot-toast";
import type { StoreTheme } from "@/lib/storeTheme";

export default function Providers({ children, theme }: { children: React.ReactNode; theme: StoreTheme }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    initAppCheckIfConfigured().catch((err) => {
      console.error("[AppCheck] init error", err);
    });
  }, []);

  return (
    <CartProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2200,
          style: {
            background: "var(--ink-2)",
            color: "var(--paper)",
            border: "1px solid var(--ash-2)",
            borderRadius: "14px",
            padding: "12px 14px",
            boxShadow: "0 10px 30px rgba(0,0,0,.25)",
          },
        }}
      />
    </CartProvider>
  );
}
