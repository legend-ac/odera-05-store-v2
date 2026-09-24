import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nuestra tienda",
  description: "Ubicación y frontis de ODERA 05 STORE en Independencia, Lima.",
};

const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=Ollantaytambo+608%2C+Tahuantinsuyo%2C+Independencia%2C+Lima%2C+Per%C3%BA";

export default function NosotrosPage() {
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
          <Link href="/catalog" className="btn-brand" style={{ fontSize: "12px", padding: "11px 18px" }}>Ver catálogo</Link>
          <Link href="/informacion/terminos" className="btn-soft" style={{ fontSize: "12px", padding: "11px 18px" }}>Información de compra</Link>
        </div>
      </section>
    </div>
  );
}
