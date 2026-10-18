import type { Metadata } from "next";
import ConsumerClaimForm from "./consumer-claim-form";
import styles from "../PublicInformation.module.css";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones",
  description: "Registra una queja o reclamo de consumo ante ODERA 05 STORE.",
};

export default function LibroReclamacionesPage() {
  return (
    <div style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <section className={styles.page}>
        <div className={styles.layout}>
        <header className={styles.heading}>
        <p className={styles.eyebrow}>Atención al consumidor</p>
        <h1 className={styles.title}>LIBRO DE RECLAMACIONES</h1>
        <p className={styles.intro}>
          Registra aquí una queja relacionada con la atención o un reclamo sobre un producto o servicio. Al enviarlo recibirás un código para hacer seguimiento.
        </p>
        <div className={styles.notice}>
          La respuesta se brinda en un plazo máximo de 15 días hábiles. La presentación de un reclamo no está condicionada a pago alguno.
        </div>
        </header>
        <div className={styles.form}><ConsumerClaimForm /></div>
        </div>
      </section>
    </div>
  );
}
