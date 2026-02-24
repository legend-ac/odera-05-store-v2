import Link from "next/link";
import FeaturedProducts from "@/components/FeaturedProducts";
import HomeSocialLinks from "@/components/HomeSocialLinks";
import { Card, CardBody } from "@/components/ui/card";
import { Container, Section } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const dynamic = "force-dynamic";

const trustItems = [
  { title: "Compra protegida", desc: "Pago validado manualmente y pedido auditado.", value: "Segura" },
  { title: "Atencion real", desc: "Soporte humano por WhatsApp durante todo el proceso.", value: "Humana" },
  { title: "Envios Peru", desc: "Lima por delivery y provincia por agencia.", value: "Nacional" },
];

export default async function HomePage() {
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
    }
  } catch {
    homePromoEnabled = true;
  }

  return (
    <Container className="py-6 md:py-8">
      <div className="flex flex-col gap-6 md:gap-8">
        <Section className="py-0">
          <div className="panel-premium bg-brand-mesh overflow-hidden p-4 sm:p-6 md:p-8">
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="flex flex-col gap-4 md:gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="success" className="rounded-xl">Marca oficial ODERA 05</Badge>
                  <Badge tone="info" className="rounded-xl">Experiencia premium</Badge>
                </div>

                <div>
                  <h1 className="text-[2rem] sm:text-[2.6rem] md:text-[3.5rem] leading-[0.94] font-display font-bold text-slate-900">
                    Zapatillas y ropa
                    <br />
                    con identidad real
                  </h1>
                  <p className="mt-3 text-[15px] md:text-[17px] text-slate-700 max-w-xl">
                    Compra con diseño moderno, seguimiento claro y atención humana. Cada pedido queda registrado de forma segura desde el inicio.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <Link href="/catalog" className="btn-brand">Ver catalogo</Link>
                  <Link href="/track" className="btn-soft">Seguir mi pedido</Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
                    <p className="text-[11px] text-emerald-700">Cupon</p>
                    <p className="text-sm font-bold text-emerald-900">{homePromo.couponCode}</p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3">
                    <p className="text-[11px] text-blue-700">Envio gratis</p>
                    <p className="text-sm font-bold text-blue-900">Desde S/{homePromo.freeShippingFrom}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white/85 p-3 col-span-2 sm:col-span-1">
                    <p className="text-[11px] text-slate-500">Seguimiento</p>
                    <p className="text-sm font-bold text-slate-900">En tiempo real</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-[var(--brand-700)] via-[var(--brand-600)] to-[var(--brand-500)] p-4 md:p-5 text-white shadow-[0_18px_35px_rgba(31,77,31,0.35)]">
                <div className="rounded-xl border border-white/35 p-4 bg-white/5">
                  <p className="text-[11px] uppercase tracking-[.16em] text-white/85">Identidad oficial</p>
                  <p className="mt-2 text-3xl font-display font-bold">ODERA 05</p>
                  <p className="text-sm text-white/90 mt-1">Zapatillas & ropa</p>
                  <div className="mt-4 h-px bg-white/30" />
                  <p className="mt-4 text-sm text-white/90 leading-relaxed">
                    Diseño pensado para convertir mejor en celular y escritorio, con una experiencia limpia y confiable.
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <span className="rounded-lg bg-white/12 px-2 py-1.5 text-xs">Stock controlado</span>
                  <span className="rounded-lg bg-white/12 px-2 py-1.5 text-xs">Pago auditado</span>
                  <span className="rounded-lg bg-white/12 px-2 py-1.5 text-xs">Canales oficiales</span>
                  <span className="rounded-lg bg-white/12 px-2 py-1.5 text-xs">Soporte directo</span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {trustItems.map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 bg-white/85 p-3">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{item.desc}</p>
                  <span className="mt-2 inline-flex rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {homePromoEnabled ? (
          <Section className="py-0">
            <Card className="bg-gradient-to-r from-emerald-50 via-white to-blue-50 border-slate-200">
              <CardBody className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{homePromo.title}</p>
                  <p className="text-sm text-slate-700">{homePromo.message}</p>
                </div>
                <div className="text-sm text-slate-700">{homePromo.rightNote}</div>
              </CardBody>
            </Card>
          </Section>
        ) : null}

        <Section className="py-0 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-display font-bold text-slate-900">Destacados</h2>
              <p className="text-sm text-slate-600">Productos recomendados por nuestros clientes.</p>
            </div>
            <Link href="/catalog" className="text-sm text-slate-700 hover:text-slate-900 font-medium">
              Ver catalogo completo
            </Link>
          </div>
          <FeaturedProducts />
        </Section>

        <HomeSocialLinks />
      </div>
    </Container>
  );
}

