"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/components/ui/layout";
import HomeSocialLinks from "@/components/HomeSocialLinks";

const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=Ollantaytambo+608%2C+Tahuantinsuyo%2C+Independencia%2C+Lima%2C+Per%C3%BA";

const footerHeading: React.CSSProperties = {
  fontFamily: "'Bebas Neue', var(--font-display), sans-serif",
  fontSize: "15px",
  letterSpacing: ".14em",
  color: "var(--paper)",
};

const footerLink: React.CSSProperties = {
  color: "var(--ash)",
  fontSize: "13px",
  lineHeight: "1.5",
};

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/dashboard")) return null;

  return (
    <footer className="mt-16" style={{ background: "#111116", borderTop: "2px solid var(--vermeil)" }}>
      <Container className="grid gap-x-10 gap-y-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr_1.15fr] lg:py-14">
        <section aria-label="ODERA 05 Store" className="flex flex-col gap-4">
          <Link href="/" className="flex w-fit items-center gap-3" aria-label="Ir al inicio de ODERA 05 Store">
            <span className="grid place-items-center font-black text-white" style={{ width: 42, height: 42, background: "var(--vermeil)", fontSize: "12px", clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}>05</span>
            <span>
              <span className="block font-black" style={{ fontFamily: "'Bebas Neue', var(--font-display), sans-serif", fontSize: "20px", letterSpacing: ".1em", color: "var(--paper)" }}>ODERA 05 STORE</span>
              <span className="block uppercase" style={{ fontSize: "9px", letterSpacing: ".18em", color: "var(--ash)" }}>Zapatillas · Ropa · Accesorios</span>
            </span>
          </Link>
          <p style={{ maxWidth: "27ch", fontSize: "13px", lineHeight: "1.65", color: "var(--ash)" }}>Compra online con información clara, seguimiento de pedido y atención por canales oficiales.</p>
          <Link href="/nosotros" className="w-fit font-bold uppercase hover:text-[var(--vermeil)]" style={{ fontSize: "11px", letterSpacing: ".12em", color: "var(--paper)" }}>Conoce nuestra tienda →</Link>
        </section>

        <nav aria-label="Información de compra" className="flex flex-col gap-3">
          <p style={footerHeading}>INFORMACIÓN</p>
          <Link href="/informacion/terminos" className="hover:text-[var(--vermeil)]" style={footerLink}>Términos y condiciones</Link>
          <Link href="/informacion/privacidad" className="hover:text-[var(--vermeil)]" style={footerLink}>Política de privacidad</Link>
          <Link href="/informacion/envios" className="hover:text-[var(--vermeil)]" style={footerLink}>Envíos y entregas</Link>
          <Link href="/informacion/cambios-devoluciones" className="hover:text-[var(--vermeil)]" style={footerLink}>Cambios y devoluciones</Link>
        </nav>

        <nav aria-label="Atención al cliente" className="flex flex-col gap-3">
          <p style={footerHeading}>ATENCIÓN</p>
          <Link href="/track" className="hover:text-[var(--vermeil)]" style={footerLink}>Seguimiento de pedido</Link>
          <Link href="/cart" className="hover:text-[var(--vermeil)]" style={footerLink}>Mi carrito</Link>
          <Link href="/libro-reclamaciones" className="font-semibold hover:text-[var(--vermeil)]" style={{ ...footerLink, color: "var(--paper)" }}>Libro de Reclamaciones</Link>
          <p style={{ ...footerLink, paddingTop: "4px" }}>Respuesta a reclamos en hasta 15 días hábiles.</p>
        </nav>

        <section aria-label="Ubicación de la tienda" className="flex flex-col gap-3">
          <p style={footerHeading}>VISÍTANOS</p>
          <address className="not-italic" style={{ ...footerLink, lineHeight: "1.65" }}>
            <strong style={{ color: "var(--paper)" }}>Ollantaytambo 608</strong><br />
            Tahuantinsuyo, Independencia<br />
            Lima, Perú
          </address>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="w-fit font-bold uppercase hover:text-[var(--vermeil)]" style={{ fontSize: "11px", letterSpacing: ".12em", color: "var(--paper)" }}>Ver cómo llegar ↗</a>
          <Link href="/nosotros" className="w-fit hover:text-[var(--vermeil)]" style={footerLink}>Frontis y ubicación de la tienda</Link>
        </section>
      </Container>

      <Container className="pb-12">
        <HomeSocialLinks compact />
      </Container>

      <div style={{ borderTop: "1px solid var(--ash-2)" }}>
        <Container className="flex flex-col gap-2 py-5 text-xs md:flex-row md:items-center md:justify-between" style={{ color: "var(--ash)" }}>
          <p>© {new Date().getFullYear()} ODERA 05 STORE. Todos los derechos reservados.</p>
          <p>Información de compra y canales de atención visibles para el consumidor.</p>
        </Container>
      </div>
    </footer>
  );
}
