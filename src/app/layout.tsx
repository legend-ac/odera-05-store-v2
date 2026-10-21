import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";
import { getMetadataBaseUrl } from "@/lib/productMetadata";
import { getSocialImages } from "@/lib/socialImages";
import { getStoreTheme } from "@/lib/server/storeTheme";
import { getStoreSocialLinks } from "@/lib/server/storeSocialLinks";

const display = localFont({
  src: "./fonts/roboto-condensed-latin.woff2",
  variable: "--font-display",
  weight: "400 700",
  style: "normal",
  display: "swap",
});

const sans = localFont({
  src: "./fonts/roboto-latin.woff2",
  variable: "--font-sans",
  weight: "400 700",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getMetadataBaseUrl(),
  title: {
    default: "ODERA 05 STORE — Zapatillas y Ropa Original",
    template: "%s | ODERA 05 STORE",
  },
  description:
    "Tienda peruana de zapatillas, ropa y accesorios originales. Pago con Yape y Plin, seguimiento de pedido en tiempo real y envío a Lima y provincias.",
  keywords: [
    "zapatillas originales",
    "ropa deportiva",
    "tienda peruana",
    "ODERA 05",
    "Yape",
    "Plin",
    "envio Lima",
    "envio provincias",
    "accesorios deportivos",
    "sneakers Peru",
  ],
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
    shortcut: "/favicon.png",
  },
  // ── Canonical & Indexing ──────────────────────────────────────────────────
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // ── Open Graph (Facebook · WhatsApp · LinkedIn · Telegram · Discord) ──────
  // JPEG ligeros: horizontal principal y cuadrado alternativo.
  openGraph: {
    title: "ODERA 05 STORE — Zapatillas y Ropa Original",
    description:
      "Zapatillas, ropa y accesorios originales con Yape y Plin. Envío a Lima y provincias. ¡Conoce el catálogo!",
    siteName: "ODERA 05 STORE",
    locale: "es_PE",
    type: "website",
    url: "/",
    images: getSocialImages(),
  },
  // ── Twitter / X Card (summary_large_image) ────────────────────────────────
  twitter: {
    card: "summary_large_image",
    title: "ODERA 05 STORE — Zapatillas y Ropa Original",
    description:
      "Zapatillas, ropa y accesorios originales con Yape y Plin. Envío a Lima y provincias.",
    images: [getSocialImages()[0]],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [theme, socialLinks] = await Promise.all([getStoreTheme(), getStoreSocialLinks()]);
  return (
    <html lang="es" data-theme={theme} className={`${sans.variable} ${display.variable}`}>
      <head>
        <link rel="preload" href="/fonts/bebas-neue-latin-v16.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body
        className="min-h-screen antialiased"
        style={{
          background: "var(--ink)",
          color: "var(--paper)",
          fontFamily: "var(--font-sans), Roboto, 'Segoe UI', sans-serif",
        }}
      >
        <Providers theme={theme}>
          <div className="min-h-dvh flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer socialLinks={socialLinks} />
          </div>
        </Providers>
      </body>
    </html>
  );
}
