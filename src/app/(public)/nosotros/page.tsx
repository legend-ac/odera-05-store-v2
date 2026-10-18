import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { normalizeStoreInformation } from "@/lib/storeInformation";
import styles from "../PublicInformation.module.css";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Nuestra tienda",
  description: "Ubicación y frontis de ODERA 05 STORE en Independencia, Lima.",
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
      <section className={styles.page}>
        <p className={styles.eyebrow}>ODERA 05 · Lima Norte</p>
        <div className={styles.visitLayout}>
          <figure className={styles.photo}>
            <div><Image src="/brand/storefront-odera-05.png" alt="Frontis de ODERA 05 STORE en Independencia, Lima" fill priority sizes="(max-width: 767px) 100vw, 620px" className="object-cover" /></div>
            <figcaption>Frontis de ODERA 05 STORE · Ollantaytambo 608, Independencia</figcaption>
          </figure>
          <div>
            <h1 className={styles.title}>NUESTRA TIENDA</h1>
            <p className={styles.intro}>Nos encuentras en Independencia, Lima. Visita el local y conoce nuestra selección de zapatillas, ropa y accesorios.</p>
            <div className={styles.visitDetails}>
              <div><h2>Dirección</h2><p>Ollantaytambo 608<br />Tahuantinsuyo, Independencia<br />Lima, Perú</p></div>
              <div><h2>Horario de atención</h2><p>{businessInformation.storeHours || "Consulta el horario de atención con la tienda antes de visitarnos."}</p></div>
            </div>
            <div className={styles.actions}><a href={mapsUrl} target="_blank" rel="noreferrer">Cómo llegar ↗</a><Link href="/catalog">Explorar catálogo</Link></div>
          </div>
        </div>
      </section>
    </div>
  );
}
