import Link from "next/link";
import Image from "next/image";
import HomeSocialLinks from "@/components/HomeSocialLinks";
import { Card, CardBody } from "@/components/ui/card";
import { Container, Section } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const dynamic = "force-dynamic";

const DEFAULT_CATEGORY_CARDS = [
  { key: "zapatillas", label: "Zapatillas", subtitle: "Running, urbano y futbol", cta: "Ver zapatillas", enabled: true },
  { key: "ropa", label: "Ropa", subtitle: "Poleras, casacas y conjuntos", cta: "Ver ropa", enabled: true },
  { key: "accesorios", label: "Accesorios", subtitle: "Mochilas, medias y mas", cta: "Ver accesorios", enabled: true },
];

function pickCategoryAsset(categoryKey: string, idx: number): string {
  const key = categoryKey.toLowerCase();
  if (key.includes("zapat")) return "/brand/category-zapatillas.svg";
  if (key.includes("ropa")) return "/brand/category-ropa.svg";
  if (key.includes("acces")) return "/brand/category-accesorios.svg";
  const pool = ["/brand/category-zapatillas.svg", "/brand/category-ropa.svg", "/brand/category-accesorios.svg"] as const;
  return pool[idx % pool.length] ?? "/brand/category-zapatillas.svg";
}

export default async function HomePage() {
  let categoryCards: Array<{ key: string; label: string; subtitle: string; cta: string; enabled: boolean }> = DEFAULT_CATEGORY_CARDS;
  let homePromoEnabled = true;
  let homePromo = {
    title: "Promocion activa",
    message: "Usa el cupon ODERA10 y recibe 10% de descuento.",
    rightNote: "Envio gratis por compras desde S/ 200.",
    couponCode: "ODERA10",
    freeShippingFrom: 200,
  };
  try {
    const settingsSnap = await adminDb.doc("settings/store").get();
    if (settingsSnap.exists) {
      const storeData = settingsSnap.data() as any;
      homePromoEnabled = Boolean(storeData?.homePromoEnabled ?? true);
      homePromo = {
        title: String(storeData?.homePromo?.title ?? homePromo.title),
        message: String(storeData?.homePromo?.message ?? homePromo.message),
        rightNote: String(storeData?.homePromo?.rightNote ?? homePromo.rightNote),
        couponCode: String(storeData?.homePromo?.couponCode ?? homePromo.couponCode),
        freeShippingFrom: Number(storeData?.homePromo?.freeShippingFrom ?? homePromo.freeShippingFrom),
      };
      if (Array.isArray(storeData?.productTypes) && storeData.productTypes.length) {
        categoryCards = storeData.productTypes
          .filter((x: any) => Boolean(x?.enabled ?? true))
          .map((x: any) => ({
            key: String(x?.key ?? ""),
            label: String(x?.label ?? ""),
            subtitle: String(x?.subtitle ?? ""),
            cta: String(x?.cta ?? ""),
            enabled: Boolean(x?.enabled ?? true),
          }))
          .filter((x: any) => x.key && x.label);
      }
    }
  } catch {
    homePromoEnabled = true;
  }
  const couponCode = homePromo.couponCode.trim();
  const quickChips: Array<{ key: string; label: string; value: string; className: string }> = [];
  if (couponCode) {
    quickChips.push({
      key: "coupon",
      label: "Cupon",
      value: couponCode,
      className: "rounded-xl border border-emerald-200 bg-emerald-50/80",
    });
  }
  quickChips.push({
    key: "shipping",
    label: "Envio gratis",
    value: `Desde S/${homePromo.freeShippingFrom}`,
    className: "rounded-xl border border-blue-200 bg-blue-50/80",
  });
  quickChips.push({
    key: "tracking",
    label: "Seguimiento",
    value: "En tiempo real",
    className: "rounded-xl border border-slate-200 bg-white/85",
  });

  return (
    <Container className="py-6 md:py-8">
      <div className="flex flex-col gap-6 md:gap-8">
        <Section className="py-0">
          <div className="panel-premium bg-brand-mesh overflow-hidden p-4 sm:p-6 md:p-8">
            <div className="grid gap-5 md:gap-8 lg:grid-cols-[1.12fr_0.88fr] items-start">
              <div className="flex flex-col gap-4 md:gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success" className="rounded-xl">Tienda oficial ODERA 05</Badge>
                  <Badge tone="info" className="rounded-xl">Compra facil y segura</Badge>
                </div>

                <div>
                  <h1 className="text-[2rem] sm:text-[2.6rem] md:text-[3.5rem] leading-[0.94] font-display font-bold text-slate-900">
                    Zapatillas y ropa
                    <br />
                    con estilo real
                  </h1>
                  <p className="mt-3 text-[15px] md:text-[17px] text-slate-700 max-w-xl">
                    Compra con confianza, seguimiento claro y atencion humana. Tu pedido queda registrado desde el inicio para que siempre sepas en que estado esta.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <Link href="/catalog" className="btn-brand">Ver catalogo</Link>
                  <Link href="/track" className="btn-soft">Seguir mi pedido</Link>
                </div>

                <div className={quickChips.length === 2 ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-2 sm:grid-cols-3 gap-2.5"}>
                  {quickChips.map((chip) => (
                    <div key={chip.key} className={`${chip.className} p-3`}>
                      <p className="text-[11px] text-slate-600">{chip.label}</p>
                      <p className="text-sm font-bold text-slate-900">{chip.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-[0_14px_28px_rgba(15,23,42,0.12)]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">Como funciona</p>
                  <h3 className="mt-2 text-2xl md:text-[1.9rem] font-display font-bold text-slate-900">Compra en 3 pasos</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Flujo simple para el cliente: elegir, pagar y seguir el pedido.
                  </p>
                </div>
                <div className="mt-4 grid gap-2.5">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-900">1. Elige tu producto</p>
                    <p className="text-xs text-slate-600">Selecciona talla, cantidad y agregalo al carrito.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-900">2. Paga y sube tu comprobante</p>
                    <p className="text-xs text-slate-600">Aceptamos Yape y Plin con validacion manual segura.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-900">3. Recibe seguimiento en tiempo real</p>
                    <p className="text-xs text-slate-600">Estado visible por codigo y atencion por WhatsApp.</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-xs text-slate-700">
                    Sigue tu pedido cuando quieras desde la opcion <span className="font-semibold">Seguir mi pedido</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {homePromoEnabled ? (
          <Section className="py-0">
            <Card className="bg-gradient-to-r from-emerald-50 via-white to-blue-50 border-slate-200">
              <CardBody className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{homePromo.title}</p>
                  <p className="text-sm text-slate-700">{homePromo.message}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-slate-700">{homePromo.rightNote}</div>
                  <Image src="/brand/promo-shipping.svg" alt="Envio y compra segura ODERA 05" width={1600} height={560} className="hidden md:block h-14 w-40 rounded-lg border border-slate-200 object-cover" />
                </div>
              </CardBody>
            </Card>
          </Section>
        ) : null}

        <Section className="py-0 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-display font-bold text-slate-900">Explora por categoria</h2>
              <p className="text-sm text-slate-600">Accede rapido a lo que te interesa comprar hoy.</p>
            </div>
            <Link href="/catalog" className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors">
              Ver todo
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {categoryCards.map((item, idx) => {
              const tones = [
                "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70",
                "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-100/70",
                "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100",
                "border-violet-200 bg-gradient-to-br from-violet-50 via-white to-violet-100/70",
              ];
              const tone = tones[idx % tones.length];
              return (
                <Link key={item.key} href={`/catalog?type=${encodeURIComponent(item.key)}`} className={`group rounded-2xl border p-3 md:p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${tone}`}>
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <Image
                      src={pickCategoryAsset(item.key, idx)}
                      alt={`${item.label} ODERA 05`}
                      width={1200}
                      height={760}
                      className="aspect-[4/2.5] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[.12em] text-slate-600">Categoria</p>
                  <h3 className="mt-1.5 text-2xl font-display font-bold text-slate-900">{item.label}</h3>
                  <p className="mt-1.5 text-sm text-slate-700">{item.subtitle || "Productos destacados en esta linea."}</p>
                  <span className="mt-4 inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 group-hover:bg-slate-100 transition-colors">
                    {item.cta || `Ver ${item.label.toLowerCase()}`}
                  </span>
                </Link>
              );
            })}
          </div>
        </Section>

        <HomeSocialLinks />
      </div>
    </Container>
  );
}

