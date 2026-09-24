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
        className="relative overflow-hidden"
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

        <div className="relative z-10 grid w-full flex-1 lg:grid-cols-2" style={{ minHeight: "clamp(500px, 85vh, 900px)" }}>

          {/* Left — Text panel */}
          <div className="flex flex-col justify-center order-2 lg:order-1 px-6 py-10 sm:px-10 lg:px-16">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-5">
              <span className="h-px w-14" style={{ background: "var(--vermeil)" }} />
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
              className="home-hero__title leading-none"
              style={{
                fontFamily: "'Bebas Neue', 'Roboto Condensed', sans-serif",
                fontSize: "clamp(58px, 7.4vw, 108px)",
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
              className="mt-4 mb-5"
              style={{ fontSize: "11px", letterSpacing: "0.18em", color: "var(--ash)" }}
            >
              ザパティージャス・ロパ ——{" "}
              <span style={{ color: "var(--paper)" }}>毎日のために厳選</span>
            </p>

            <p
              className="max-w-sm mb-7"
              style={{ fontSize: "14px", color: "var(--ash)", lineHeight: "1.7" }}
            >
              Zapatillas, ropa y accesorios seleccionados para todos los días.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <Link href="/catalog" className="btn-brand" style={{ fontSize: "13px", padding: "12px 24px" }}>
                Comprar ahora →
              </Link>
              <Link href="/track" className="btn-soft" style={{ fontSize: "13px", padding: "12px 24px" }}>
                Seguir pedido
              </Link>
            </div>

            {/* Stats */}
            <div
              className="mt-8 pt-5 grid grid-cols-3 gap-4"
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
                      fontSize: "28px",
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

          {/* Right — Image */}
          <div
            className="relative order-1 lg:order-2 overflow-hidden flex items-center justify-center"
            style={{
              /* Mobile: altura fija natural; desktop: ocupa toda la columna */
              minHeight: "clamp(260px, 44vw, 560px)",
              background: "var(--ink)",
            }}
          >
            <Image
              src="/brand/category-zapatillas.jpg"
              alt="Colección ODERA 05"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-contain"
              style={{ padding: "clamp(16px, 5%, 56px)" }}
            />
            {/* Gradiente sutil: solo difumina los bordes laterales en desktop para fusionar con el texto */}
            <div
              className="absolute inset-0 pointer-events-none hidden lg:block"
              style={{
                background:
                  "linear-gradient(to right, rgba(14,14,18,0.85) 0%, transparent 20%, transparent 80%, rgba(14,14,18,0.5) 100%)",
              }}
            />
            {/* Gradiente móvil: desvanece solo la parte inferior para transición suave al texto */}
            <div
              className="absolute inset-0 pointer-events-none lg:hidden"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 60%, rgba(14,14,18,0.9) 100%)",
              }}
            />
            {/* Badge sutil sin triángulo */}
            <div
              className="absolute bottom-4 right-4"
              style={{
                background: "rgba(14,14,18,0.75)",
                backdropFilter: "blur(4px)",
                border: "1px solid var(--ash-2)",
                borderRadius: "2px",
                padding: "4px 10px",
              }}
            >
              <span className="font-bold uppercase" style={{ fontSize: "9px", letterSpacing: "0.2em", color: "rgba(243,238,228,0.6)" }}>
                Selección semanal
              </span>
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
