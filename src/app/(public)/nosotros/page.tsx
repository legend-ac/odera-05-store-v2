import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { normalizeStoreInformation } from "@/lib/storeInformation";
import { getSocialImages } from "@/lib/socialImages";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Nuestra tienda",
  description:
    "Visítanos en Ollantaytambo 608, Tahuantinsuyo, Independencia, Lima. Conoce el frontis y el horario de ODERA 05 STORE.",
  alternates: { canonical: "/nosotros" },
  openGraph: {
    title: "Nuestra Tienda — ODERA 05 STORE",
    description:
      "ODERA 05 STORE en Independencia, Lima Norte. Dirección, horario de atención y frontis del local.",
    siteName: "ODERA 05 STORE",
    locale: "es_PE",
    type: "website",
    url: "/nosotros",
    images: [
      {
        // Foto real del local — imagen más auténtica para esta página
        url: "/brand/storefront-odera-05.png",
        width: 1200,
        height: 630,
        alt: "Frontis de ODERA 05 STORE — Independencia, Lima",
        type: "image/png",
      },
      getSocialImages()[1],
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nuestra Tienda — ODERA 05 STORE",
    description:
      "Visítanos en Independencia, Lima Norte. Dirección y horario de ODERA 05 STORE.",
    images: [{ url: "/brand/storefront-odera-05.png", alt: "Frontis ODERA 05 STORE" }],
  },
};

const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=Ollantaytambo+608%2C+Tahuantinsuyo%2C+Independencia%2C+Lima%2C+Per%C3%BA";

export default async function NosotrosPage() {
  let businessInformation = normalizeStoreInformation(undefined);
  try {
    const settings = await adminDb.doc("settings/store").get();
    businessInformation = normalizeStoreInformation(settings.data()?.businessInformation);
  } catch {
    // Visiting information remains available while store settings are unavailable.
  }

  return (
    <div style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-16">
        <p className="mb-3 font-black uppercase" style={{ color: "var(--vermeil)", fontSize: "10px", letterSpacing: ".26em" }}>ODERA 05 · Lima Norte</p>
        <div className="grid gap-10 lg:grid-cols-[1.12fr_.88fr] lg:items-end">
          <div>
            <h1 className="leading-none" style={{ fontFamily: "'Bebas Neue', var(--font-display), sans-serif", fontSize: "clamp(48px, 8vw, 90px)", letterSpacing: ".04em" }}>NUESTRA<br />TIENDA</h1>
            <p className="mt-5 max-w-lg" style={{ color: "var(--ash)", fontSize: "15px", lineHeight: "1.75" }}>Además de comprar en línea, puedes ubicarnos en Independencia. Esta página reúne la dirección y el frontis para que identifiques el local antes de visitarnos.</p>
          </div>
          <div className="border-l-2 pl-5" style={{ borderColor: "var(--vermeil)" }}>
            <p className="font-bold" style={{ fontSize: "16px" }}>Ollantaytambo 608</p>
            <p className="mt-1" style={{ color: "var(--ash)", fontSize: "14px", lineHeight: "1.6" }}>Tahuantinsuyo, Independencia<br />Lima, Perú</p>
            <p className="mt-4 font-bold" style={{ fontSize: "14px" }}>Horario de atención</p>
            <p className="mt-1 whitespace-pre-line" style={{ color: "var(--ash)", fontSize: "14px", lineHeight: "1.6" }}>{businessInformation.storeHours || "Consulta el horario de atención con la tienda antes de visitarnos."}</p>
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-brand mt-5 inline-flex" style={{ fontSize: "12px", padding: "11px 18px" }}>Abrir en Google Maps ↗</a>
          </div>
        </div>

        <figure className="mt-10 overflow-hidden" style={{ border: "1px solid var(--ash-2)", background: "var(--ink-2)" }}>
          <div className="relative aspect-[16/9] min-h-[260px]">
            <Image src="/brand/storefront-odera-05.png" alt="Frontis de ODERA 05 STORE en Independencia, Lima" fill priority sizes="(max-width: 1200px) 100vw, 1120px" className="object-cover" />
          </div>
          <figcaption className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: "1px solid var(--ash-2)" }}>
            <span className="font-bold uppercase" style={{ fontSize: "11px", letterSpacing: ".14em" }}>Frontis de ODERA 05 STORE</span>
            <span style={{ color: "var(--ash)", fontSize: "12px" }}>Ollantaytambo 608 · Independencia, Lima</span>
          </figcaption>
        </figure>

        <div className="mt-10 flex flex-wrap gap-3" style={{ borderTop: "1px solid var(--ash-2)", paddingTop: "28px" }}>
          <Link href="/catalog" prefetch={false} className="btn-brand" style={{ fontSize: "12px", padding: "11px 18px" }}>Ver catálogo</Link>
          <Link href="/informacion/terminos" className="btn-soft" style={{ fontSize: "12px", padding: "11px 18px" }}>Información de compra</Link>
        </div>
      </section>
    </div>
  );
}
