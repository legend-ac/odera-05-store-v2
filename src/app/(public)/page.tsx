import Link from "next/link";
import FeaturedProducts from "@/components/FeaturedProducts";
import HomeSocialLinks from "@/components/HomeSocialLinks";
import { Card, CardBody } from "@/components/ui/card";
import { Container, Section } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const dynamic = "force-dynamic";

const trustItems = [
  {
    title: "Compra protegida",
    desc: "Pedido registrado y validacion manual del pago en cada compra.",
    value: "100% segura",
  },
  {
    title: "Atencion humana",
    desc: "Soporte real por WhatsApp para ayudarte antes y despues de pagar.",
    value: "Respuesta real",
  },
  {
    title: "Despacho nacional",
    desc: "Delivery en Lima y envio por agencia a todo Peru.",
    value: "Cobertura nacional",
  },
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
    <Container className="py-7 md:py-10">
      <div className="flex flex-col gap-8 md:gap-10">
        <Section className="py-0">
          <Card className="overflow-hidden border border-slate-200 bg-[radial-gradient(980px_520px_at_100%_-20%,rgba(59,130,246,.28)_0%,rgba(59,130,246,0)_55%),radial-gradient(900px_520px_at_-10%_120%,rgba(16,185,129,.24)_0%,rgba(16,185,129,0)_52%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] panel-soft-hover">
            <CardBody className="grid gap-7 lg:grid-cols-[1.12fr_0.88fr] md:p-8 p-5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info" className="w-fit rounded-xl">Marca peruana</Badge>
                  <Badge tone="success" className="w-fit rounded-xl">Confianza verificada</Badge>
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl md:text-5xl font-display font-bold leading-[0.98] text-slate-900">
                    Compra con
                    <br />
                    estilo y confianza
                  </h1>
                  <p className="text-slate-600 max-w-xl text-[15px] md:text-base">
                    ODERA 05 combina una experiencia visual premium con procesos claros: pedido registrado, pago validado y seguimiento en tiempo real.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <Link href="/catalog" className="btn-brand">Ver catalogo</Link>
                  <Link href="/track" className="btn-soft">Seguir mi pedido</Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 max-w-2xl">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                    <p className="text-[11px] text-emerald-700">Cupon activo</p>
                    <p className="text-sm font-semibold text-emerald-900">{homePromo.couponCode}</p>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2">
                    <p className="text-[11px] text-blue-700">Envio gratis</p>
                    <p className="text-sm font-semibold text-blue-900">Desde S/{homePromo.freeShippingFrom}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                    <p className="text-[11px] text-slate-500">Seguimiento</p>
                    <p className="text-sm font-semibold text-slate-900">Estado en tiempo real</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-blue-200/60 via-sky-200/40 to-emerald-200/55 blur-2xl" />
                <div className="rounded-[1.5rem] border border-slate-200 bg-white/92 p-4 md:p-5 shadow-[0_18px_45px_rgba(15,23,42,0.14)]">
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-5">
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">Identidad oficial ODERA 05</p>
                    <p className="mt-2 text-2xl font-display font-bold">Retail visual premium</p>
                    <p className="mt-1 text-sm text-slate-200">Interfaz clara, compra segura y experiencia mobile-first.</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <span className="rounded-lg bg-white/10 px-2 py-1">Stock controlado</span>
                      <span className="rounded-lg bg-white/10 px-2 py-1">Pago auditado</span>
                      <span className="rounded-lg bg-white/10 px-2 py-1">Tracking activo</span>
                      <span className="rounded-lg bg-white/10 px-2 py-1">Soporte humano</span>
                    </div>
                  </div>

                  <div className="mt-4 grid sm:grid-cols-3 gap-2.5">
                    {trustItems.map((item) => (
                      <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.desc}</p>
                        <span className="mt-2 inline-flex rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </Section>

        {homePromoEnabled ? (
          <Section className="py-0">
            <Card className="bg-gradient-to-r from-emerald-50 via-white to-sky-50 border-slate-200 panel-soft-hover">
              <CardBody className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
