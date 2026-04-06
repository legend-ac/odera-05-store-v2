import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import HomeSocialLinks from "@/components/HomeSocialLinks";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inicio — Zapatillas, Ropa y Accesorios Originales",
  description:
    "Zapatillas, ropa y accesorios originales con envío a todo el Perú. Paga con Yape o Plin y sigue tu pedido en tiempo real.",
};

const DEFAULTS = {
  cards: [
    { key: "zapatillas", label: "Zapatillas", subtitle: "Running, urbano y futbol", cta: "Ver zapatillas", urgency: "🔥 Más vendido" },
    { key: "ropa", label: "Ropa", subtitle: "Poleras, casacas y conjuntos", cta: "Ver ropa", urgency: "⚡ Nueva temporada" },
    { key: "accesorios", label: "Accesorios", subtitle: "Mochilas, medias y más", cta: "Ver accesorios", urgency: "🎒 Stock limitado" },
  ],
  promo: { couponCode: "ODERA10", message: "10% OFF en tu primer pedido.", freeShippingFrom: 200 },
};

// Gradientes más cálidos, que se vean bonitos sin tapar demasiado la imagen
const ACCENTS = [
  { grad: "from-emerald-600/70 via-emerald-900/55 to-slate-900/90", pill: "bg-emerald-500" },
  { grad: "from-amber-500/70   via-orange-800/55   to-slate-900/90", pill: "bg-amber-500" },
  { grad: "from-violet-500/70  via-violet-800/55   to-slate-900/90", pill: "bg-violet-500" },
  { grad: "from-sky-500/70     via-sky-800/55      to-slate-900/90", pill: "bg-sky-500" },
];

function img(key: string, idx: number, url?: string) {
  if (url) return url;
  if (key.includes("zapat")) return "/brand/category-zapatillas.jpg";
  if (key.includes("ropa")) return "/brand/category-ropa.jpg";
  if (key.includes("acces")) return "/brand/category-accesorios.jpg";
  return ["/brand/category-zapatillas.jpg", "/brand/category-ropa.jpg", "/brand/category-accesorios.jpg"][idx % 3]!;
}

export default async function HomePage() {
  type Card = { key: string; label: string; subtitle: string; cta: string; enabled: boolean; imageUrl?: string; urgency?: string };
  let cards: Card[] = DEFAULTS.cards.map(c => ({ ...c, enabled: true }));
  let promoOn = true;
  let promo = { ...DEFAULTS.promo };

  try {
    const snap = await adminDb.doc("settings/store").get();
    if (snap.exists) {
      const d = snap.data() as any;
      promoOn = Boolean(d?.homePromoEnabled ?? true);
      promo = {
        couponCode: String(d?.homePromo?.couponCode ?? promo.couponCode),
        message: String(d?.homePromo?.message ?? promo.message),
        freeShippingFrom: Number(d?.homePromo?.freeShippingFrom ?? promo.freeShippingFrom),
      };
      if (Array.isArray(d?.productTypes) && d.productTypes.length) {
        cards = d.productTypes
          .filter((x: any) => x?.enabled !== false)
          .map((x: any, i: number) => ({
            key: String(x.key ?? ""), label: String(x.label ?? ""),
            subtitle: String(x.subtitle ?? ""), cta: String(x.cta ?? "Ver colección"),
            enabled: true,
            imageUrl: typeof x.imageUrl === "string" && x.imageUrl ? x.imageUrl : undefined,
            urgency: DEFAULTS.cards[i]?.urgency,
          }))
          .filter((x: Card) => x.key && x.label);
      }
    }
  } catch { /* defaults */ }

  const coupon = promo.couponCode.trim();

  return (
    <div className="bg-slate-50 min-h-screen">

      {/* ══ 1. BARRA PROMO — slim y elegante ══════════════════════════ */}
      {promoOn && (
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2 text-center">
          <p className="text-[12px] font-medium text-white/95 tracking-wide">
            {coupon && (
              <span className="mr-2 rounded-md bg-white/20 px-2 py-0.5 font-mono font-bold text-[11px] tracking-widest">
                {coupon}
              </span>
            )}
            {promo.message}
            {" · "}
            <Link href="/catalog" className="font-semibold underline-offset-2 underline whitespace-nowrap hover:text-emerald-100 transition-colors">
              Ver colección →
            </Link>
          </p>
        </div>
      )}

      {/* ══ 2. HERO ════════════════════════════════════════════════════ */}
      <div className="relative bg-gradient-to-b from-[#0d1f15] via-slate-900 to-[#111827] px-4 pt-8 pb-10 sm:pt-10 sm:pb-12 text-center">
        {/* Orb decorativo sutil */}
        <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 h-64 w-64 rounded-full bg-emerald-500/8 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-xl flex flex-col items-center gap-4">

          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/80">
            Tienda oficial · ODERA 05
          </p>

          <h1 className="text-[2rem] sm:text-[2.5rem] md:text-[3rem] font-display font-extrabold leading-[1.1] text-white">
            Zapatillas y ropa
            <span className="block bg-gradient-to-r from-emerald-400 via-emerald-300 to-lime-300 bg-clip-text text-transparent mt-0.5">
              con estilo real
            </span>
          </h1>

          <p className="text-[13px] text-slate-400 leading-relaxed max-w-xs">
            Marcas originales · Pago con Yape y Plin · Seguimiento en tiempo real
          </p>

          {/* Pills de beneficios */}
          <div className="flex flex-wrap justify-center gap-1.5 mt-1">
            {[
              { e: "🚚", t: `Envío gratis +S/${promo.freeShippingFrom}` },
              { e: "💳", t: "Yape y Plin" },
              { e: "📞", t: "Atención directa" },
            ].map(p => (
              <span key={p.t} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-medium text-slate-300">
                <span>{p.e}</span>{p.t}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex items-center gap-2.5 mt-1">
            <Link
              href="/catalog"
              className="inline-flex h-11 items-center rounded-xl bg-emerald-500 px-7 text-[14px] font-bold text-white shadow-[0_4px_20px_rgba(16,185,129,0.35)] hover:bg-emerald-400 hover:shadow-[0_6px_24px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ease-out"
            >
              Ver catálogo
            </Link>
            <Link
              href="/track"
              className="inline-flex h-11 items-center rounded-xl border border-white/20 bg-white/8 px-5 text-[14px] font-medium text-white/90 hover:bg-white/15 hover:border-white/30 transition-all duration-200 ease-out"
            >
              Seguir pedido
            </Link>
          </div>

        </div>
      </div>

      {/* ══ 3. CATEGORÍAS ══════════════════════════════════════════════ */}
      <div className="mx-auto max-w-5xl px-3 sm:px-5 pt-5 pb-3">

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-display font-bold text-slate-800 tracking-tight">
            ¿Qué buscas hoy?
          </h2>
          <Link href="/catalog" className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors">
            Ver todo →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {cards.map((card, i) => {
            const acc = ACCENTS[i % ACCENTS.length]!;
            return (
              <Link
                key={card.key}
                href={`/catalog?type=${encodeURIComponent(card.key)}`}
                className="group relative overflow-hidden rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.15)] transition-all duration-300 ease-out hover:-translate-y-1"
              >
                <div className="relative aspect-[2/1] sm:aspect-[4/3] overflow-hidden">
                  <Image
                    src={img(card.key, i, card.imageUrl)}
                    alt={card.label}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                  />
                  {/* Gradiente más suave — muestra mejor la imagen */}
                  <div className={`absolute inset-0 bg-gradient-to-t ${acc.grad}`} />
                  {/* Viñeta extra en esquinas para profundidad */}
                  <div className="absolute inset-0 bg-gradient-to-br from-black/10 to-transparent" />

                  <div className="absolute inset-0 flex flex-col justify-between p-3.5">
                    {/* Badges arriba */}
                    <div className="flex items-start justify-between gap-1">
                      {card.urgency && (
                        <span className="inline-flex items-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-white leading-none">
                          {card.urgency}
                        </span>
                      )}
                      <span className={`ml-auto rounded-full ${acc.pill} shadow-sm px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white leading-snug`}>
                        {card.label}
                      </span>
                    </div>

                    {/* Info abajo */}
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <p className="text-[15px] sm:text-[16px] font-display font-extrabold leading-tight text-white drop-shadow-sm">
                          {card.label}
                        </p>
                        <p className="text-[11px] text-white/65 mt-0.5">{card.subtitle}</p>
                      </div>
                      <div className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white/95 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-slate-900 shadow-sm group-hover:gap-2 group-hover:bg-white transition-all duration-200">
                        {card.cta}
                        <svg className="h-2.5 w-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ══ 4. TRUST BADGES ════════════════════════════════════════════ */}
      <div className="mx-auto max-w-5xl px-3 sm:px-5 pb-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { e: "✅", t: "Productos originales", c: "emerald" },
            { e: "🚚", t: `Envío gratis +S/${promo.freeShippingFrom}`, c: "blue" },
            { e: "💬", t: "Soporte por WhatsApp", c: "emerald" },
            { e: "📦", t: "Seguimiento en vivo", c: "violet" },
          ].map(g => (
            <div
              key={g.t}
              className="flex items-center gap-2 rounded-xl bg-white border border-slate-100 px-3 py-2.5 text-[11.5px] font-medium text-slate-700 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:border-slate-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] transition-all duration-200"
            >
              <span className="text-[15px] shrink-0">{g.e}</span>
              <span className="leading-tight">{g.t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ 5. REDES SOCIALES ══════════════════════════════════════════ */}
      <div className="mx-auto max-w-5xl px-3 sm:px-5 pb-3">
        <HomeSocialLinks />
      </div>

      {/* ══ 6. CÓMO FUNCIONA ═══════════════════════════════════════════ */}
      <div className="mx-auto max-w-5xl px-3 sm:px-5 pb-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3.5">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-emerald-400">Proceso de compra</p>
              <p className="text-sm font-display font-extrabold text-white mt-0.5">Compra en 3 pasos</p>
            </div>
            <Link
              href="/catalog"
              className="rounded-xl bg-emerald-500 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-400 hover:shadow-[0_4px_12px_rgba(16,185,129,0.4)] transition-all duration-200"
            >
              Comprar ahora
            </Link>
          </div>
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            {[
              { n: "01", t: "Elige tu producto", d: "Selecciona talla y cantidad.", e: "🛒" },
              { n: "02", t: "Paga con Yape/Plin", d: "Sube tu comprobante de pago.", e: "💳" },
              { n: "03", t: "Sigue tu pedido", d: "Revisa el estado con tu código.", e: "📦" },
            ].map(s => (
              <div key={s.n} className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors duration-150">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                  {s.e}
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{s.n}</p>
                  <p className="text-[13px] font-bold text-slate-900 mt-0.5">{s.t}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
