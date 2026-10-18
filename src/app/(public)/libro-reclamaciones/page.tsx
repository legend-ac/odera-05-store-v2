import type { Metadata } from "next";
import ConsumerClaimForm from "./consumer-claim-form";

export const metadata: Metadata = {
  title: "Libro de Reclamaciones",
  description: "Registra una queja o reclamo de consumo ante ODERA 05 STORE.",
};

export default function LibroReclamacionesPage() {
  return (
    <div style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <section className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="font-black uppercase" style={{ color: "var(--vermeil)", fontSize: "10px", letterSpacing: ".25em" }}>Atención al consumidor</p>
        <h1 className="mt-3 leading-none" style={{ fontFamily: "'Bebas Neue', var(--font-display), sans-serif", fontSize: "clamp(40px, 7vw, 68px)", letterSpacing: ".04em" }}>LIBRO DE<br />RECLAMACIONES</h1>
        <p className="mt-5 max-w-2xl" style={{ color: "var(--ash)", fontSize: "15px", lineHeight: "1.75" }}>
          Registra aquí una queja relacionada con la atención o un reclamo sobre un producto o servicio. Al enviarlo recibirás un código para hacer seguimiento.
        </p>
        <div className="mt-8 border-l-2 px-4 py-1" style={{ borderColor: "var(--vermeil)", background: "rgba(232,69,44,.06)", color: "var(--ash)", fontSize: "13px", lineHeight: "1.6" }}>
          La respuesta se brinda en un plazo máximo de 15 días hábiles. La presentación de un reclamo no está condicionada a pago alguno.
        </div>
        <ConsumerClaimForm />
      </section>
    </div>
  );
}
