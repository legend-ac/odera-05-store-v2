import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import FeaturedProducts from "@/components/FeaturedProducts";
import CategoryGrid from "@/components/CategoryGrid";
import HomeSocialLinks from "@/components/HomeSocialLinks";
import styles from "@/components/HomeSections.module.css";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { normalizeStoreInformation } from "@/lib/storeInformation";

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
  let promo = { enabled: true, message: "Envío gratis desde S/ 200", couponCode: "" };

  try {
    const snapshot = await adminDb.doc("settings/store").get();
    if (snapshot.exists) {
      const data = snapshot.data() as any;
      storeHours = normalizeStoreInformation(data?.businessInformation).storeHours;
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
    // storefront stays with defaults
  }

  return (
    <div style={{ background: "var(--ink)", color: "var(--paper)" }}>

      {/* ── Promo Banner ── */}
      {promo.enabled && (
        <div
          className="promo-banner"
          style={{
            background: "var(--vermeil)",
            borderBottom: "1px solid var(--vermeil-2)",
          }}
        >
          <p className="sr-only">
            {promo.couponCode ? `${promo.couponCode} · ` : ""}{promo.message} · ODERA 05
          </p>
          <div className="promo-banner__track" aria-hidden="true">
            {[0, 1].map((copy) => (
              <div className="promo-banner__group" key={copy}>
                {Array.from({ length: 8 }, (_, repeat) => (
                  <span className="promo-banner__item" key={repeat}>
                    <span className="promo-banner__star">★</span>
                    {promo.couponCode && (
                      <span className="promo-banner__coupon">{promo.couponCode}</span>
                    )}
                    <span>{promo.message}</span>
                    <span className="promo-banner__star">★</span>
                    <span>ODERA 05 · ペルー</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section
        className={`${styles.hero} home-hero relative overflow-hidden`}
        style={{ display: "flex", flexDirection: "column", background: "var(--hero-gradient)" }}
      >
        {/* Speed lines background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -15deg,
              transparent,
              transparent 40px,
              rgba(232,69,44,0.025) 40px,
              rgba(232,69,44,0.025) 41px
            )`,
          }}
        />

        <div className={`${styles.heroShell} home-hero__shell relative z-10 mx-auto grid w-full lg:grid-cols-12 items-center`}>

          {/* Left — Text panel (col-span-7 on desktop, full width on mobile) */}
          <div className={`${styles.heroCopy} home-hero__copy flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 lg:col-span-7`}>
            {/* Eyebrow */}
            <div className={`${styles.heroEyebrow} flex items-center gap-3 mb-4`}>
              <span className="h-px w-12" style={{ background: "var(--vermeil)" }} />
              <span
                className="font-black"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.28em",
                  color: "var(--vermeil)",
                  textTransform: "uppercase",
                }}
              >
                ODERA 05 · Perú
              </span>
            </div>

            {/* Main headline */}
            <h1
              className={`${styles.heroTitle} leading-none`}
              style={{
                fontFamily: "'Bebas Neue', var(--font-display), sans-serif",
                fontSize: "clamp(52px, 6.2vw, 96px)",
                letterSpacing: "0.04em",
                color: "var(--paper)",
              }}
            >
              <span className="block">MUÉVETE</span>
              <span
                className="block"
                style={{
                  WebkitTextStroke: "2px var(--paper)",
                  color: "transparent",
                }}
              >
                A TU
              </span>
              <span
                className="block"
                style={{
                  background: "linear-gradient(135deg, var(--vermeil) 0%, var(--gold) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                MANERA.
              </span>
            </h1>

            {/* Subtitle japonés */}
            <p
              className={`${styles.heroMicrocopy} mt-3 mb-4`}
              style={{ fontSize: "12px", letterSpacing: "0.14em", color: "var(--ash)" }}
            >
              ザパティージャス・ロパ ——{" "}
              <span style={{ color: "var(--paper)" }}>毎日のために厳選</span>
            </p>

            <p
              className={`${styles.heroDescription} max-w-md mb-6`}
              style={{ fontSize: "15px", color: "var(--ash)", lineHeight: "1.6" }}
            >
              Zapatillas, ropa y accesorios seleccionados para todos los días.
            </p>

            {/* CTAs */}
            <div className={`${styles.heroActions} flex flex-wrap items-center gap-3`}>
              <Link href="/catalog" className="btn-brand" style={{ fontSize: "13px", padding: "12px 26px" }}>
                Comprar ahora →
              </Link>
              <Link href="/track" className="btn-soft" style={{ fontSize: "13px", padding: "12px 24px" }}>
                Seguir pedido
              </Link>
            </div>

            {/* Stats */}
            <div
              className={`${styles.heroStats} mt-8 pt-5 grid grid-cols-3 gap-4 max-w-md`}
              style={{ borderTop: "1px solid var(--ash-2)" }}
            >
              {[
                { num: "100%", label: "Original" },
                { num: "24h", label: "Respuesta" },
                { num: "Lima+", label: "Despacho" },
              ].map(({ num, label }) => (
                <div key={label} className="flex flex-col gap-1">
                  <span
                    className="font-black"
                    style={{
                      fontFamily: "'Bebas Neue', var(--font-display), sans-serif",
                      fontSize: "26px",
                      color: "var(--paper)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {num}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.18em",
                      color: "var(--ash)",
                      textTransform: "uppercase",
                    }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Character card, visible at every screen width */}
          <div className={`${styles.heroMedia} flex lg:col-span-5 items-center justify-center p-6 lg:p-8`}>
            <div
              className={`${styles.heroCard} home-hero__media-card relative w-full max-w-[340px] xl:max-w-[380px] h-[440px] xl:h-[490px] rounded overflow-hidden`}
              style={{
                border: "1px solid rgba(232, 69, 44, 0.22)",
                boxShadow: "var(--shadow-elevated)",
                background: "var(--hero-art-surface)",
              }}
            >
              {/* Corner badge top-left */}
              <div
                className={`${styles.heroBadge} absolute top-3 left-3 z-10`}
                style={{
                  background: "var(--header-background)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid var(--ash-2)",
                  borderRadius: "2px",
                  padding: "3px 8px",
                }}
              >
                <span style={{ fontSize: "9px", letterSpacing: "0.2em", color: "var(--vermeil)", fontWeight: 800 }}>
                  05 · EDITION
                </span>
              </div>

              <Image
                src="/brand/hero-mascot-v2.png"
                alt="Colección ODERA 05"
                fill
                priority
                sizes="(max-width: 639px) 320px, (max-width: 1023px) 40vw, 400px"
                className={`${styles.heroImage} object-contain`}
                style={{ objectPosition: "center bottom" }}
              />

              {/* Subtle bottom fade */}
              <div
                className={`${styles.heroOverlay} absolute inset-0 pointer-events-none`}
                style={{ background: "var(--hero-art-overlay)" }}
              />

              {/* Badge bottom-right */}
              <div
                className={`${styles.heroBadge} absolute bottom-3 right-3 z-10`}
                style={{
                  background: "var(--header-background)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid var(--ash-2)",
                  borderRadius: "2px",
                  padding: "3px 8px",
                }}
              >
                <span style={{ fontSize: "9px", letterSpacing: "0.18em", color: "var(--ash)", fontWeight: 700, textTransform: "uppercase" }}>
                  Selección semanal
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature strip ── */}
      <section
        style={{
          borderTop: "1px solid var(--ash-2)",
          borderBottom: "1px solid var(--ash-2)",
          background: "var(--ink-2)",
        }}
      >
        <div
          className="mx-auto grid max-w-7xl grid-cols-1 sm:grid-cols-3"
          style={{ borderColor: "var(--ash-2)" }}
        >
          {[
            { num: "01", label: "Productos originales" },
            { num: "02", label: "Envíos a Lima y provincias" },
            { num: "03", label: "Pagos con Yape y Plin" },
          ].map(({ num, label }, i) => (
            <div
              key={label}
              className="flex items-center gap-4 px-6 py-5"
              style={{
                borderRight: i < 2 ? "1px solid var(--ash-2)" : "none",
                borderBottom: "none",
              }}
            >
              <span
                className="font-black tabular-nums"
                style={{
                  fontFamily: "'Bebas Neue', var(--font-display), sans-serif",
                  fontSize: "24px",
                  color: "var(--vermeil)",
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                }}
              >
                {num}
              </span>
              <span
                className="font-semibold"
                style={{ fontSize: "13px", color: "var(--paper)", letterSpacing: "0.02em" }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Categorías ── */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-8 flex items-end justify-between pb-4" style={{ borderBottom: "1px solid var(--ash-2)" }}>
          <div>
            <p
              className="font-black"
              style={{
                fontSize: "10px",
                letterSpacing: "0.28em",
                color: "var(--vermeil)",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              探索 · Explora
            </p>
            <h2
              className="font-black"
              style={{
                fontFamily: "'Bebas Neue', var(--font-display), sans-serif",
                fontSize: "clamp(28px, 5vw, 42px)",
                letterSpacing: "0.06em",
                color: "var(--paper)",
              }}
            >
              COMPRA POR CATEGORÍA
            </h2>
          </div>
          <Link
            href="/catalog"
            className="hidden sm:flex items-center gap-2 font-bold uppercase transition-colors duration-150 hover:text-[var(--vermeil)]"
            style={{ fontSize: "12px", letterSpacing: "0.1em", color: "var(--paper)" }}
          >
            Ver todo →
          </Link>
        </div>

        {/* Client component con hover interactivo */}
        <CategoryGrid categories={categories} />
      </section>

      {/* ── Novedades ── */}
      <section className="py-12 sm:py-16" style={{ background: "var(--ink-2)" }}>
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-8 flex items-end justify-between pb-4" style={{ borderBottom: "1px solid var(--ash-2)" }}>
            <div>
              <p
                className="font-black"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.28em",
                  color: "var(--vermeil)",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                新着 · Recién llegado
              </p>
              <h2
                className="font-black"
                style={{
                  fontFamily: "'Bebas Neue', var(--font-display), sans-serif",
                  fontSize: "clamp(28px, 5vw, 42px)",
                  letterSpacing: "0.06em",
                  color: "var(--paper)",
                }}
              >
                NOVEDADES
              </h2>
            </div>
            <Link
              href="/catalog"
              className="flex items-center gap-2 font-bold uppercase transition-colors duration-150 hover:text-[var(--vermeil)]"
              style={{ fontSize: "12px", letterSpacing: "0.1em", color: "var(--ash)" }}
            >
              Ver catálogo →
            </Link>
          </div>
          <FeaturedProducts />
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-6 sm:grid-cols-[0.8fr_1.2fr] sm:gap-10">
          <div>
            <p
              className="font-black"
              style={{
                fontSize: "10px",
                letterSpacing: "0.28em",
                color: "var(--vermeil)",
                textTransform: "uppercase",
                marginBottom: "12px",
              }}
            >
              シンプル · Compra simple
            </p>
            <h2
              className="font-black leading-tight"
              style={{
                fontFamily: "'Bebas Neue', var(--font-display), sans-serif",
                fontSize: "clamp(32px, 6vw, 52px)",
                letterSpacing: "0.06em",
                color: "var(--paper)",
              }}
            >
              SIN PASOS<br />CONFUSOS.
            </h2>
          </div>

          <ol>
            {[
              { step: "01", text: "Elige talla y agrega al carrito." },
              { step: "02", text: "Confirma tu reserva y paga con Yape o Plin." },
              { step: "03", text: "Envía tu comprobante y sigue tu pedido." },
            ].map(({ step, text }) => (
              <li
                key={step}
                className="flex items-start gap-5 py-5"
                style={{ borderBottom: "1px solid var(--ash-2)" }}
              >
                <span
                  className="font-black shrink-0"
                  style={{
                    fontFamily: "'Bebas Neue', var(--font-display), sans-serif",
                    fontSize: "32px",
                    color: "var(--vermeil)",
                    letterSpacing: "0.04em",
                    lineHeight: 1,
                    minWidth: "3ch",
                  }}
                >
                  {step}
                </span>
                <p
                  className="font-semibold leading-relaxed"
                  style={{ fontSize: "15px", color: "var(--paper)", paddingTop: "6px" }}
                >
                  {text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <HomeSocialLinks />

      {/* ── Tienda física ── */}
      <section id="ubicacion" className={styles.store} aria-labelledby="store-title">
        <div className={`${styles.shell} ${styles.storeInner}`}>
          <div className={styles.storeImage}>
            <Image src="/brand/storefront-odera-05.png" alt="Frontis de ODERA 05 STORE en Independencia, Lima" fill sizes="(max-width: 767px) 100vw, 50vw" className={styles.storePhoto} />
            <p>Tienda física · Lima Norte</p>
          </div>
          <div className={styles.storeCopy}>
            <p className={styles.kicker}>Encuéntranos</p>
            <h2 id="store-title">VISITA LA TIENDA</h2>
            <p className={styles.storeDescription}>Conoce zapatillas, ropa y accesorios en persona. Nuestro equipo te ayuda a encontrar la talla y el estilo que buscas.</p>
            <dl className={styles.storeDetails}>
              <div><dt>Dirección</dt><dd>Ollantaytambo 608<span>Tahuantinsuyo, Independencia · Lima, Perú</span></dd></div>
              <div><dt>{storeHours ? "Horario" : "Atención"}</dt><dd className="whitespace-pre-line">{storeHours || "Consulta horarios y disponibilidad por WhatsApp."}</dd></div>
            </dl>
            <div className={styles.storeActions}>
              <a href="https://www.google.com/maps/search/?api=1&query=Ollantaytambo+608%2C+Tahuantinsuyo%2C+Independencia%2C+Lima%2C+Per%C3%BA" target="_blank" rel="noreferrer" className="btn-brand">Cómo llegar <span aria-hidden="true">↗</span></a>
              <Link href="/nosotros" className={styles.secondaryLink}>Conoce la tienda <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--ink-2)", borderTop: "1px solid var(--ash-2)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -15deg,
              transparent,
              transparent 30px,
              rgba(232,69,44,0.03) 30px,
              rgba(232,69,44,0.03) 31px
            )`,
          }}
        />
        <div className="relative z-10 mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16 text-center">
          <p
            className="font-black mb-4"
            style={{
              fontSize: "10px",
              letterSpacing: "0.28em",
              color: "var(--vermeil)",
              textTransform: "uppercase",
            }}
          >
            ★ ODERA 05 STORE ★
          </p>
          <h2
            className="font-black leading-tight mb-8"
            style={{
              fontFamily: "'Bebas Neue', var(--font-display), sans-serif",
              fontSize: "clamp(36px, 8vw, 72px)",
              letterSpacing: "0.04em",
              color: "var(--paper)",
            }}
          >
            EMPIEZA A EXPLORAR<br />
            <span
              style={{
                background: "linear-gradient(135deg, var(--vermeil) 0%, var(--gold) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              TU ESTILO.
            </span>
          </h2>
          <Link
            href="/catalog"
            className="btn-brand inline-flex"
            style={{ fontSize: "14px", padding: "14px 36px" }}
          >
            Ver catálogo completo →
          </Link>
        </div>
      </section>

    </div>
  );
}
