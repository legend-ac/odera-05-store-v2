import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { formatPEN } from "@/lib/money";
import { normalizeStoreInformation } from "@/lib/storeInformation";
import styles from "../../PublicInformation.module.css";

export const revalidate = 60;

const pages = {
  terminos: {
    title: "Términos y condiciones",
    intro: "Estas condiciones explican cómo funciona la compra en ODERA 05 STORE antes de que confirmes un pedido.",
    sections: [
      ["Productos y disponibilidad", "Cada producto muestra su precio, variantes y disponibilidad. Primero confirmamos el stock y el total al crear el pedido y reservamos tus productos. Si una talla se agota, podrás corregir el carrito antes de pagar."],
      ["Precios y pago", "Los precios se muestran en soles (S/). Revisa el total, incluido el envío, antes de pagar. Una vez creada la reserva, podrás realizar el pago y enviar el comprobante dentro del plazo indicado en tu pedido. El pago queda pendiente de validación por la tienda."],
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
    intro: "Revisa el costo del envío antes de pagar y registra correctamente los datos de quien recibirá el pedido.",
    sections: [
      ["Modalidades de entrega", "Para Lima, registra el distrito, la dirección y una referencia. Para provincias, indica el departamento, la provincia y la agencia de destino. Verifica el nombre, documento y teléfono de la persona que recibirá el pedido."],
      ["Costo de envío", "El resumen de tu pedido muestra el costo de envío y el total antes de realizar el pago."],
      ["Fecha de entrega", "La fecha depende del destino y la modalidad de despacho. Consulta con la tienda el plazo estimado para tu dirección o agencia antes de pagar. La coordinación de la entrega no modifica el costo incluido en el pedido."],
      ["Seguimiento", "Después de registrar tu pedido, conserva su enlace privado y código de seguimiento. Desde Seguimiento podrás consultar los cambios de estado de tu pedido, desde su registro hasta la entrega."],
    ],
  },
  "cambios-devoluciones": {
    title: "Cambios y devoluciones",
    intro: "Antes de comprar, consulta las condiciones de cambio del producto que elegiste. Si ya compraste, estos son los pasos para solicitar atención.",
    sections: [
      ["Antes de confirmar la compra", "Pregunta por el plazo para solicitar un cambio, el estado requerido del producto, los comprobantes necesarios y los costos de traslado que correspondan a tu caso. Solicita que te confirmen esas condiciones antes de pagar."],
      ["Prepara tu solicitud", "Conserva el código de pedido y el comprobante. Indica el producto, la talla o variante y el motivo de tu solicitud. Si hay una falla o recibiste un producto distinto, adjunta fotografías que permitan identificar el problema."],
      ["Contacta con la tienda", "Envía la información por el canal de atención oficial. La tienda revisará la compra y te indicará cómo continuar. Antes de trasladar o enviar el producto, solicita la dirección, el procedimiento y la confirmación de los costos aplicables."],
      ["Quejas y reclamos", "Puedes registrar una queja o un reclamo de consumo en el Libro de Reclamaciones disponible en el sitio. Conserva la constancia para consultar el seguimiento de tu caso."],
    ],
  },
} as const;

type PageKey = keyof typeof pages;

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = pages[slug as PageKey];
  return page ? { title: page.title, description: page.intro } : {};
}

export default async function InformacionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug as PageKey];
  if (!page) notFound();

  let freeShippingFrom = 200;
  let businessInformation = normalizeStoreInformation(undefined);
  if (slug === "envios" || slug === "cambios-devoluciones") {
    try {
      const settings = await adminDb.doc("settings/store").get();
      const configured = Number(settings.data()?.homePromo?.freeShippingFrom ?? 200);
      freeShippingFrom = Math.max(0, Number.isFinite(configured) ? configured : 200);
      businessInformation = normalizeStoreInformation(settings.data()?.businessInformation);
    } catch {
      // Checkout confirms the current price before a payment is requested.
    }
  }

  const sections = page.sections.flatMap<[string, string]>(([heading, text]) => {
    if (slug === "envios" && heading === "Fecha de entrega") {
      return [
        ["Plazo estimado en Lima", businessInformation.deliveryLima || "Consulta con la tienda el plazo estimado para tu distrito y dirección antes de pagar."],
        ["Plazo estimado en provincias", businessInformation.deliveryProvinces || "Consulta con la tienda el plazo estimado para tu provincia y agencia de destino antes de pagar."],
      ];
    }
    if (slug === "cambios-devoluciones" && heading === "Antes de confirmar la compra") {
      return [
        ["Plazo para solicitar cambios", businessInformation.exchangePeriod || "Consulta con la tienda el plazo para solicitar un cambio y desde qué fecha se cuenta. Confirma esta información antes de pagar."],
        ["Condiciones para cambios y devoluciones", businessInformation.exchangeConditions || "Consulta el estado requerido del producto, los comprobantes necesarios y los costos de traslado aplicables a tu caso. Solicita que la tienda te confirme estas condiciones antes de pagar."],
      ];
    }
    if (slug !== "envios" || heading !== "Costo de envío") return [[heading, text]];
    const rate = freeShippingFrom === 0
      ? "El envío es gratis para todos los pedidos."
      : `La tarifa de envío es ${formatPEN(10)}. El envío es gratis desde ${formatPEN(freeShippingFrom)} de subtotal de productos, antes de aplicar descuentos.`;
    return [[heading, `${rate} El costo y el total quedan incluidos en el resumen del pedido antes de pagar.`]];
  });

  return (
    <div style={{ background: "var(--ink)", color: "var(--paper)" }}>
      <article className={styles.page}>
        <Link href="/" className={styles.back}>← Volver a la tienda</Link>
        <div className={styles.layout}>
        <header className={styles.heading}>
        <p className={styles.eyebrow}>Información para comprar</p>
        <h1 className={styles.title}>{page.title}</h1>
        <p className={styles.intro}>{slug === "cambios-devoluciones" && (businessInformation.exchangePeriod || businessInformation.exchangeConditions) ? "Revisa los plazos y condiciones de la tienda antes de comprar. Si ya compraste, sigue estos pasos para solicitar atención." : page.intro}</p>
        <nav className={styles.sideLinks} aria-label="Más información">
          <Link href="/libro-reclamaciones">Libro de Reclamaciones ↗</Link>
          <Link href="/nosotros">Ubicación de la tienda ↗</Link>
        </nav>
        </header>
        <div className={styles.sections}>
          {sections.map(([heading, text], index) => (
            <section key={heading}>
              <span className={styles.number}>0{index + 1}</span>
              <div><h2>{heading}</h2><p>{text}</p></div>
            </section>
          ))}
        </div>
        </div>
      </article>
    </div>
  );
}
