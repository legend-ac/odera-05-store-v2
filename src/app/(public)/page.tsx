import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import FeaturedProducts from "@/components/FeaturedProducts";
import CategoryGrid from "@/components/CategoryGrid";
import { adminDb } from "@/lib/server/firebaseAdmin";

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
  let promo = { enabled: true, message: "Envío gratis desde S/ 200", couponCode: "" };

  try {
    const snapshot = await adminDb.doc("settings/store").get();
    if (snapshot.exists) {
      const data = snapshot.data() as any;
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
          className="px-4 py-2.5 text-center"
          style={{
            background: "var(--vermeil)",
            borderBottom: "1px solid var(--vermeil-2)",
          }}
        >
          <p
            className="font-black text-white flex items-center justify-center gap-6 flex-wrap"
            style={{
              fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
              fontSize: "13px",
              letterSpacing: "0.2em",
            }}
          >
            <span>★</span>
            {promo.couponCode && (
              <span
                style={{
                  border: "1px solid rgba(255,255,255,0.5)",
                  padding: "1px 6px",
                  fontFamily: "monospace",
                  fontSize: "10px",
                }}
              >
                {promo.couponCode}
              </span>
            )}
            <span>{promo.message}</span>
            <span>★</span>
            <span>ODERA 05 · ペルー</span>
            <span>★</span>
          </p>
        </div>
      )}

      {/* ── HERO ── */}
      <section
        className="home-hero relative overflow-hidden"
        style={{ display: "flex", flexDirection: "column", background: "var(--ink)" }}
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

        <div className="home-hero__shell relative z-10 mx-auto grid w-full lg:grid-cols-12 items-center">

          {/* Left — Text panel (col-span-7 on desktop, full width on mobile) */}
          <div className="home-hero__copy flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 lg:col-span-7">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-4">
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
              className="leading-none"
              style={{
                fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
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
              className="mt-3 mb-4"
              style={{ fontSize: "11px", letterSpacing: "0.18em", color: "var(--ash)" }}
            >
              ザパティージャス・ロパ ——{" "}
              <span style={{ color: "var(--paper)" }}>毎日のために厳選</span>
            </p>

            <p
              className="max-w-md mb-6"
              style={{ fontSize: "14px", color: "var(--ash)", lineHeight: "1.6" }}
            >
              Zapatillas, ropa y accesorios seleccionados para todos los días.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/catalog" className="btn-brand" style={{ fontSize: "13px", padding: "12px 26px" }}>
                Comprar ahora →
              </Link>
              <Link href="/track" className="btn-soft" style={{ fontSize: "13px", padding: "12px 24px" }}>
                Seguir pedido
              </Link>
            </div>

            {/* Stats */}
            <div
              className="mt-8 pt-5 grid grid-cols-3 gap-4 max-w-md"
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
                      fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
                      fontSize: "26px",
                      color: "var(--paper)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {num}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
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

          {/* Right — Character card: Hidden on mobile (conversion-first UX), sleek compact card on desktop */}
          <div className="hidden lg:flex lg:col-span-5 items-center justify-center p-6 lg:p-8">
            <div
              className="home-hero__media-card relative w-full max-w-[340px] xl:max-w-[380px] h-[440px] xl:h-[490px] rounded overflow-hidden"
              style={{
                border: "1px solid rgba(232, 69, 44, 0.22)",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(232, 69, 44, 0.08)",
                background: "radial-gradient(circle at 50% 30%, rgba(232, 69, 44, 0.12), transparent 60%), linear-gradient(180deg, #13131a 0%, #09090d 100%)",
              }}
            >
              {/* Corner badge top-left */}
              <div
                className="absolute top-3 left-3 z-10"
                style={{
                  background: "rgba(14,14,18,0.75)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid rgba(90,88,104,0.4)",
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
                sizes="400px"
                className="object-contain"
                style={{ objectPosition: "center bottom" }}
              />

              {/* Subtle bottom fade */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: "linear-gradient(to top, rgba(9,9,13,0.85) 0%, transparent 28%)" }}
              />

              {/* Badge bottom-right */}
              <div
                className="absolute bottom-3 right-3 z-10"
                style={{
                  background: "rgba(14,14,18,0.75)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid rgba(90,88,104,0.4)",
                  borderRadius: "2px",
                  padding: "3px 8px",
                }}
              >
                <span style={{ fontSize: "9px", letterSpacing: "0.18em", color: "rgba(243,238,228,0.7)", fontWeight: 700, textTransform: "uppercase" }}>
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
                  fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
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
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="mb-10 flex items-end justify-between pb-4" style={{ borderBottom: "1px solid var(--ash-2)" }}>
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
                fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
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
            style={{ fontSize: "12px", letterSpacing: "0.1em", color: "var(--ash)" }}
          >
            Ver todo →
          </Link>
        </div>

        {/* Client component con hover interactivo */}
        <CategoryGrid categories={categories} />
      </section>

      {/* ── Novedades ── */}
      <section style={{ background: "var(--ink-2)", padding: "64px 0" }}>
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
                  fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
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
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-10 sm:grid-cols-[0.8fr_1.2fr]">
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
                fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
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
              { step: "02", text: "Registra tu pago con Yape o Plin." },
              { step: "03", text: "Revisa el estado de tu pedido." },
            ].map(({ step, text }) => (
              <li
                key={step}
                className="flex items-start gap-5 py-5"
                style={{ borderBottom: "1px solid var(--ash-2)" }}
              >
                <span
                  className="font-black shrink-0"
                  style={{
                    fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
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

      {/* ── Tienda física ── */}
      <section
        id="ubicacion"
        hidden
        className="relative overflow-hidden"
        style={{ background: "var(--ink-2)", borderTop: "1px solid var(--ash-2)", borderBottom: "1px solid var(--ash-2)" }}
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.06fr_0.94fr] lg:items-center">
          <div className="relative overflow-hidden" style={{ border: "1px solid var(--ash-2)", minHeight: "320px" }}>
            <Image
              src="/brand/storefront-odera-05.png"
              alt="Frontis de ODERA 05 STORE en Independencia, Lima"
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 p-5" style={{ background: "linear-gradient(0deg, rgba(14,14,18,.96), transparent)" }}>
              <p className="font-black uppercase" style={{ fontSize: "10px", letterSpacing: ".2em", color: "var(--paper)" }}>Tienda física · Lima Norte</p>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:pl-4">
            <div>
              <p className="font-black uppercase mb-2" style={{ fontSize: "10px", letterSpacing: ".28em", color: "var(--vermeil)" }}>Encuéntranos</p>
              <h2 className="font-black leading-none" style={{ fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif", fontSize: "clamp(34px, 5vw, 52px)", letterSpacing: ".06em", color: "var(--paper)" }}>
                VISITA LA<br />TIENDA
              </h2>
            </div>
            <p className="max-w-md" style={{ fontSize: "14px", color: "var(--ash)", lineHeight: "1.7" }}>
              Conoce zapatillas, ropa y accesorios en persona. Nuestro equipo te ayuda a encontrar la talla y el estilo que buscas.
            </p>
            <div className="grid gap-3" style={{ borderTop: "1px solid var(--ash-2)", paddingTop: "16px" }}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center" style={{ background: "rgba(232,69,44,.12)", color: "var(--vermeil)" }}>⌖</span>
                <div><p className="font-bold" style={{ fontSize: "13px", color: "var(--paper)" }}>Ollantaytambo 608</p><p style={{ fontSize: "12px", color: "var(--ash)", marginTop: "2px" }}>Tahuantinsuyo, Independencia · Lima, Perú</p></div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center" style={{ background: "rgba(232,69,44,.12)", color: "var(--vermeil)" }}>◷</span>
                <div><p className="font-bold" style={{ fontSize: "13px", color: "var(--paper)" }}>Atención directa</p><p style={{ fontSize: "12px", color: "var(--ash)", marginTop: "2px" }}>Consulta horarios y disponibilidad por WhatsApp.</p></div>
              </div>
            </div>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Ollantaytambo+608%2C+Tahuantinsuyo%2C+Independencia%2C+Lima%2C+Per%C3%BA"
              target="_blank"
              rel="noreferrer"
              className="btn-brand w-fit"
              style={{ fontSize: "12px", padding: "11px 20px" }}
            >
              Abrir en Google Maps →
            </a>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-5 pb-14 sm:px-8 sm:pb-20">
          <div className="overflow-hidden" style={{ height: "280px", border: "1px solid var(--ash-2)" }}>
            <iframe
              title="Ubicación de ODERA 05 STORE"
              src="https://www.google.com/maps?q=Ollantaytambo%20608%2C%20Tahuantinsuyo%2C%20Independencia%2C%20Lima%2C%20Per%C3%BA&output=embed"
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
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
        <div className="relative z-10 mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24 text-center">
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
              fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
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
