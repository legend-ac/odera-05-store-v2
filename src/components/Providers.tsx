"use client";

import { useEffect } from "react";
import { initAppCheckIfConfigured } from "@/lib/firebase/appCheck";
import { CartProvider } from "@/components/cart/CartProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAppCheckIfConfigured().catch((err) => {
      console.error("[AppCheck] init error", err);
    });
  }, []);

  return <CartProvider>{children}</CartProvider>;
}
