"use client";

import { useEffect } from "react";
import { initAppCheckIfConfigured } from "@/lib/firebase/appCheck";
import { CartProvider } from "@/components/cart/CartProvider";
import { Toaster } from "react-hot-toast";

export default function Providers({ children }: { children: React.ReactNode }) {
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
            background: "#0b0f19",
            color: "#fff",
            borderRadius: "14px",
            padding: "12px 14px",
            boxShadow: "0 10px 30px rgba(0,0,0,.25)",
          },
        }}
      />
    </CartProvider>
  );
}
