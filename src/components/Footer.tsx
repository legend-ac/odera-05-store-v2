"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import HomeSocialLinks, { type SocialLinks } from "@/components/HomeSocialLinks";
import styles from "./StoreChrome.module.css";

const mapsUrl = "https://www.google.com/maps/search/?api=1&query=Ollantaytambo+608%2C+Tahuantinsuyo%2C+Independencia%2C+Lima%2C+Per%C3%BA";

export default function Footer({ initialLinks }: { initialLinks?: SocialLinks }) {
  const pathname = usePathname();
  const [isHome, setIsHome] = useState(false);
  useEffect(() => { setIsHome(pathname === "/"); }, [pathname]);
  if (pathname === "/login" || pathname.startsWith("/dashboard")) return null;

  return (
    <footer className={isHome ? "mt-0" : "mt-12"} style={{ background: "var(--footer-background)", borderTop: "1px solid var(--ash-2)" }}>
      <div className={styles.footerInner}>
        <section aria-label="ODERA 05 Store" className={styles.footerBrand}>
          <Link href="/" className={styles.brand} aria-label="Ir al inicio de ODERA 05 Store">
            <span className={styles.mark}>05</span>
            <span className={styles.brandCopy}><strong>ODERA 05 STORE</strong><span>Zapatillas · Ropa · Accesorios</span></span>
          </Link>
          <p>Tu próximo par, tu siguiente movimiento. Encuentra zapatillas, ropa y accesorios en nuestra tienda.</p>
          <Link href="/nosotros" className={styles.footerAction}>Conoce ODERA 05 <span aria-hidden="true">&nbsp;↗</span></Link>
        </section>

        <nav aria-label="Información de compra" className={styles.footerNav}>
          <h2>INFORMACIÓN</h2>
          <Link href="/informacion/envios">Envíos y entregas</Link>
          <Link href="/informacion/cambios-devoluciones">Cambios y devoluciones</Link>
          <Link href="/informacion/terminos">Términos y condiciones</Link>
          <Link href="/informacion/privacidad">Política de privacidad</Link>
        </nav>

        <nav aria-label="Atención al cliente" className={styles.footerNav}>
          <h2>TE AYUDAMOS</h2>
          <Link href="/track">Seguimiento de pedido</Link>
          <Link href="/cart">Mi carrito</Link>
          <Link href="/libro-reclamaciones">Libro de Reclamaciones</Link>
          <p>Atención de reclamos en hasta 15 días hábiles.</p>
        </nav>

        <section aria-label="Ubicación de la tienda" className={styles.footerNav}>
          <h2>VEN A CONOCERNOS</h2>
          <address><strong>Ollantaytambo 608</strong><br />Tahuantinsuyo, Independencia<br />Lima, Perú</address>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className={styles.footerAction}>Cómo llegar <span aria-hidden="true">&nbsp;↗</span></a>
          <Link href="/nosotros">Ubicación y horario de atención</Link>
        </section>
      </div>

      {!isHome && <div className={styles.footerSocials}><HomeSocialLinks compact initialLinks={initialLinks} /></div>}

      <div style={{ borderTop: "1px solid var(--ash-2)" }}>
        <div className={styles.footerBottom}>
          <p>© {new Date().getFullYear()} ODERA 05 STORE. Todos los derechos reservados.</p>
          <p>Hecho para moverte. Desde Lima, Perú.</p>
        </div>
      </div>
    </footer>
  );
}
