import "./globals.css";
import type { Metadata } from "next";
import { Roboto, Roboto_Condensed } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";

const display = Roboto_Condensed({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "700"],
  display: "swap",
});

const sans = Roboto({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${display.variable}`}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900">
        <Providers>
          <div className="min-h-dvh flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
