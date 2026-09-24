import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

const pages = {
  terminos: {
    title: "Términos y condiciones",
    intro: "Estas condiciones explican cómo funciona la compra en ODERA 05 STORE antes de que confirmes un pedido.",
    sections: [
      ["Productos y disponibilidad", "Cada producto muestra su precio, variantes y disponibilidad. El stock se confirma al crear el pedido; si no fuera posible atenderlo, se informará al cliente antes de solicitar un pago adicional."],
      ["Precios y pago", "Los precios se muestran en soles (S/). El proceso de compra solicita los datos de contacto y el comprobante del medio de pago elegido para validar el pedido."],
      ["Pedido y seguimiento", "Tras registrar el pedido, se genera un código de seguimiento. El cliente puede revisar su estado desde la sección Seguimiento."],
    ],
  },
  privacidad: {
    title: "Política de privacidad",
    intro: "Protegemos la información que nos compartes durante la compra y la usamos solo para atender tu pedido y brindarte soporte.",
    sections: [
      ["Datos que se solicitan", "Durante la compra se solicitan datos de contacto, entrega y pago necesarios para procesar el pedido y coordinar el despacho."],
      ["Finalidad", "Los datos se usan para validar la compra, comunicar el estado del pedido, coordinar la entrega y atender solicitudes del cliente."],
      ["Tus solicitudes", "Puedes solicitar información, actualización o atención sobre tus datos mediante los canales oficiales de la tienda. No compartas información sensible por redes sociales."],
    ],
  },
  envios: {
    title: "Envíos y entregas",
    intro: "Antes de finalizar una compra podrás registrar los datos necesarios para coordinar la entrega.",
    sections: [
      ["Cobertura", "Se realizan coordinaciones de despacho para Lima y provincias, de acuerdo con la información de entrega registrada por el cliente."],
      ["Coordinación", "El pedido se revisa luego de la validación del pago. La fecha, modalidad y costo aplicable se comunican durante la coordinación."],
      ["Seguimiento", "Conserva el código de pedido para consultar su estado en línea."],
    ],
  },
  "cambios-devoluciones": {
    title: "Cambios y devoluciones",
    intro: "Si necesitas atención después de una compra, registra primero tu caso para que podamos revisarlo con la información del pedido.",
    sections: [
      ["Solicitud", "Indica el código de pedido, el producto y el motivo de tu solicitud mediante los canales de atención o el Libro de Reclamaciones."],
      ["Evaluación", "Cada solicitud se evalúa según el estado del producto, la información de compra y las condiciones comunicadas durante la venta."],
      ["Atención", "Para quejas o reclamos de consumo, el Libro de Reclamaciones está disponible de forma visible en el sitio."],
    ],
  },
} as const;

type PageKey = keyof typeof pages;

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = pages[params.slug as PageKey];
  return page ? { title: page.title, description: page.intro } : {};
}

export default function InformacionPage({ params }: { params: { slug: string } }) {
  const page = pages[params.slug as PageKey];
  if (!page) notFound();

  return (
    <div style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <article className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <Link href="/" className="font-bold uppercase hover:text-[var(--vermeil)]" style={{ color: "var(--ash)", fontSize: "10px", letterSpacing: ".15em" }}>← Volver a la tienda</Link>
        <p className="mt-8 font-black uppercase" style={{ color: "var(--vermeil)", fontSize: "10px", letterSpacing: ".25em" }}>Información para el consumidor</p>
        <h1 className="mt-3 leading-none" style={{ fontFamily: "'Bebas Neue', var(--font-display), sans-serif", fontSize: "clamp(40px, 7vw, 68px)", letterSpacing: ".04em" }}>{page.title}</h1>
        <p className="mt-5 max-w-2xl" style={{ color: "var(--ash)", fontSize: "16px", lineHeight: "1.75" }}>{page.intro}</p>
        <div className="mt-10 grid gap-0" style={{ borderTop: "1px solid var(--ash-2)" }}>
          {page.sections.map(([heading, text], index) => (
            <section key={heading} className="grid gap-3 py-6 sm:grid-cols-[50px_1fr]" style={{ borderBottom: "1px solid var(--ash-2)" }}>
              <span style={{ color: "var(--vermeil)", fontFamily: "'Bebas Neue', var(--font-display), sans-serif", fontSize: "22px" }}>0{index + 1}</span>
              <div><h2 className="font-bold" style={{ fontSize: "16px" }}>{heading}</h2><p className="mt-2" style={{ color: "var(--ash)", fontSize: "14px", lineHeight: "1.7" }}>{text}</p></div>
            </section>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/libro-reclamaciones" className="btn-brand" style={{ fontSize: "12px", padding: "11px 18px" }}>Libro de Reclamaciones</Link>
          <Link href="/nosotros" className="btn-soft" style={{ fontSize: "12px", padding: "11px 18px" }}>Ubicación de la tienda</Link>
        </div>
      </article>
    </div>
  );
}
