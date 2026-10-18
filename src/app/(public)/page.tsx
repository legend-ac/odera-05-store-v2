import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import FeaturedProducts from "@/components/FeaturedProducts";
import CategoryGrid from "@/components/CategoryGrid";
import HomeSocialLinks, { type SocialLinks } from "@/components/HomeSocialLinks";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { normalizeStoreInformation } from "@/lib/storeInformation";
import styles from "@/components/HomeStorefront.module.css";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Zapatillas, ropa y accesorios",
  description: "Zapatillas, ropa y accesorios originales con envíos a todo el Perú.",
};

type Category = { key: string; label: string; subtitle: string; cta: string; imageUrl?: string };

const DEFAULT_CATEGORIES: Category[] = [
  { key: "zapatillas", label: "Zapatillas", subtitle: "Running, urbano y fútbol", cta: "Ver zapatillas" },
  { key: "ropa", label: "Ropa", subtitle: "Poleras, casacas y conjuntos", cta: "Ver ropa" },
  { key: "accesorios", label: "Accesorios", subtitle: "Los detalles para completar tu look", cta: "Ver accesorios" },
];

export default async function HomePage() {
  let categories = DEFAULT_CATEGORIES;
  let storeHours = "";
  let socialLinks: SocialLinks | undefined;
  let promo = { enabled: true, message: "Envío gratis desde S/ 200", couponCode: "" };

  try {
    const snapshot = await adminDb.doc("settings/store").get();
    if (snapshot.exists) {
      const data = snapshot.data() as any;
      storeHours = normalizeStoreInformation(data?.businessInformation).storeHours;
      socialLinks = data?.socialLinks && typeof data.socialLinks === "object" ? data.socialLinks : {};
      promo = {
        enabled: Boolean(data?.homePromoEnabled ?? true),
        message: String(data?.homePromo?.message ?? promo.message),
        couponCode: String(data?.homePromo?.couponCode ?? "").trim(),
      };
      if (Array.isArray(data?.productTypes) && data.productTypes.length) {
        const configured = data.productTypes
          .filter((item: any) => item?.enabled !== false)
          .map((item: any) => ({
            key: String(item?.key ?? "").trim(),
            label: String(item?.label ?? "").trim(),
            subtitle: String(item?.subtitle ?? "").trim(),
            cta: String(item?.cta ?? "Ver colección").trim(),
            imageUrl: typeof item?.imageUrl === "string" && item.imageUrl ? item.imageUrl : undefined,
          }))
          .filter((item: Category) => item.key && item.label);
        if (configured.length) categories = configured;
      }
    }
  } catch {
    // The storefront remains available with its configured defaults.
  }

  return (
    <div className={styles.home}>
      {promo.enabled && (
        <div className={`promo-banner ${styles.promo}`}>
          <p className="sr-only">
            {promo.couponCode ? `${promo.couponCode} · ` : ""}{promo.message} · ODERA 05
          </p>
          <div className="promo-banner__track" aria-hidden="true">
            {[0, 1].map((copy) => (
              <div className="promo-banner__group" key={copy}>
                {Array.from({ length: 8 }, (_, repeat) => (
                  <span className="promo-banner__item" key={repeat}>
                    <span className="promo-banner__star">★</span>
                    {promo.couponCode && <span className="promo-banner__coupon">{promo.couponCode}</span>}
                    <span>{promo.message}</span>
                    <span className="promo-banner__star">★</span>
                    <span>ODERA 05 · PERÚ</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <section className={styles.hero} aria-labelledby="home-title">
        <div className={`${styles.shell} ${styles.heroLayout}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>ODERA 05 STORE · PERÚ</p>
            <h1 id="home-title" className={styles.heroTitle}>
              MUÉVETE <br />A TU <span>MANERA.</span>
            </h1>
            <p className={styles.heroDescription}>
              Zapatillas, ropa y accesorios seleccionados para todos los días.
            </p>
            <div className={styles.heroActions}>
              <Link href="/catalog" className={styles.primaryLink}>Explorar catálogo <span aria-hidden="true">↗</span></Link>
              <Link href="#categorias" className={styles.secondaryLink}>Elegir categoría <span aria-hidden="true">↓</span></Link>
            </div>
            <Link href="/track" className={styles.trackingLink}>¿Ya compraste? Sigue tu pedido <span aria-hidden="true">→</span></Link>
          </div>
          <div className={styles.heroArt}>
            <span className={styles.artNumber} aria-hidden="true">05</span>
            <Image
              src="/brand/hero-mascot-v2.png"
              alt="Colección ODERA 05"
              fill
              priority
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 45vw, 520px"
              className={styles.mascot}
            />
            <div className={styles.artCaption}><span>ODERA ORIGINALS</span><span>ESTILO EN MOVIMIENTO ↗</span></div>
          </div>
        </div>
        <div className={`${styles.shell} ${styles.benefits}`}>
          <div><span aria-hidden="true">✓</span><p>Productos originales</p></div>
          <div><span aria-hidden="true">↗</span><p>Envíos a Lima y provincias</p></div>
          <div><span aria-hidden="true">○</span><p>Pagos con Yape y Plin</p></div>
        </div>
      </section>

      <section id="categorias" className={`${styles.shell} ${styles.section}`} aria-labelledby="categories-title">
        <div className={styles.sectionHeader}>
          <div><p className={styles.eyebrow}>ENCUENTRA LO TUYO</p><h2 id="categories-title">Compra por categoría</h2></div>
          <Link href="/catalog" className={styles.textLink}>Ver todo <span aria-hidden="true">↗</span></Link>
        </div>
        <CategoryGrid categories={categories} />
      </section>

      <section className={styles.featuredSection} aria-labelledby="featured-title">
        <div className={`${styles.shell} ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <div><p className={styles.eyebrow}>EXPLORA LA SELECCIÓN</p><h2 id="featured-title">Novedades</h2></div>
            <Link href="/catalog" className={styles.textLink}>Ver catálogo <span aria-hidden="true">↗</span></Link>
          </div>
          <FeaturedProducts />
        </div>
      </section>

      <section className={`${styles.shell} ${styles.shoppingGuide}`} aria-labelledby="shopping-title">
        <div className={styles.guideIntro}><p className={styles.eyebrow}>DE LA TIENDA A TI</p><h2 id="shopping-title">Así de simple.</h2><Link href="/track" className={styles.textLink}>Seguir mi pedido <span aria-hidden="true">↗</span></Link></div>
        <ol className={styles.steps}>
          {[
            { title: "Elige tu producto", text: "Selecciona tu talla y agrégalo al carrito." },
            { title: "Confirma y paga", text: "Reserva tu pedido y paga con Yape o Plin." },
            { title: "Sigue tu pedido", text: "Envía tu comprobante y revisa el estado de tu compra." },
          ].map((step, index) => (
            <li key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>
          ))}
        </ol>
      </section>

      <section id="ubicacion" className={styles.storeSection} aria-labelledby="store-title">
        <div className={`${styles.shell} ${styles.storeLayout}`}>
          <div className={styles.storeImage}>
            <Image src="/brand/storefront-odera-05.png" alt="Frontis de ODERA 05 STORE en Independencia, Lima" fill sizes="(max-width: 767px) 100vw, 50vw" className="object-cover" />
            <span>Tienda física · Lima Norte</span>
          </div>
          <div className={styles.storeCopy}>
            <p className={styles.eyebrow}>TAMBIÉN NOS ENCUENTRAS AQUÍ</p>
            <h2 id="store-title">Pasa por <br />la tienda.</h2>
            <p className={styles.storeDescription}>Conoce zapatillas, ropa y accesorios en persona. Te ayudamos a encontrar la talla y el estilo que buscas.</p>
            <address className={styles.storeAddress}><strong>Ollantaytambo 608</strong><span>Tahuantinsuyo, Independencia · Lima, Perú</span></address>
            <div className={styles.storeHours}><strong>{storeHours ? "Horario de atención" : "Atención directa"}</strong><p>{storeHours || "Consulta horarios y disponibilidad por WhatsApp."}</p></div>
            <div className={styles.storeActions}>
              <a href="https://www.google.com/maps/search/?api=1&query=Ollantaytambo+608%2C+Tahuantinsuyo%2C+Independencia%2C+Lima%2C+Per%C3%BA" target="_blank" rel="noreferrer" className={styles.primaryLink}>Cómo llegar <span aria-hidden="true">↗</span></a>
              <Link href="/nosotros" className={styles.textLink}>Conoce ODERA <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </section>

      <HomeSocialLinks initialLinks={socialLinks} />
    </div>
  );
}
