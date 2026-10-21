import type { Metadata } from "next";
import { getSocialImages } from "@/lib/socialImages";

export const metadata: Metadata = {
  title: "Seguimiento de pedido",
  description:
    "Ingresa tu código de pedido y consulta el estado de tu compra en ODERA 05 STORE en tiempo real.",
  alternates: { canonical: "/track" },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Seguimiento de pedido — ODERA 05 STORE",
    description:
      "Consulta el estado de tu pedido con tu código de seguimiento. Envíos a Lima y provincias.",
    siteName: "ODERA 05 STORE",
    locale: "es_PE",
    type: "website",
    url: "/track",
    images: getSocialImages(),
  },
  twitter: {
    card: "summary_large_image",
    title: "Seguimiento de pedido — ODERA 05 STORE",
    description:
      "Ingresa tu código y revisa el estado de tu pedido en tiempo real.",
    images: [getSocialImages()[0]],
  },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
