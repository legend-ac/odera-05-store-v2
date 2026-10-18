import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";
import { getMetadataBaseUrl } from "@/lib/productMetadata";
import { getStoreSocialLinks, getStoreTheme } from "@/lib/server/storeTheme";

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
  ],
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "ODERA 05 STORE — Zapatillas y Ropa Original",
    description:
      "Tienda peruana de zapatillas, ropa y accesorios originales. Pago con Yape y Plin.",
    siteName: "ODERA 05 STORE",
    locale: "es_PE",
    type: "website",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [theme, socialLinks] = await Promise.all([getStoreTheme(), getStoreSocialLinks()]);
  return (
    <html lang="es" data-theme={theme} className={`${sans.variable} ${display.variable}`}>
      <head>
        {/* Bebas Neue — fuente display manga/anime */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap"
          rel="stylesheet"
        />
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
            <Footer initialLinks={socialLinks ?? undefined} />
          </div>
        </Providers>
      </body>
    </html>
  );
}
