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
    desc: "Pedido registrado en tiempo real y validacion manual de pago.",
    value: "Segura",
  },
  {
    title: "Atencion humana",
    desc: "Soporte directo por WhatsApp y redes oficiales.",
    value: "Directa",
  },
  {
    title: "Despacho nacional",
    desc: "Delivery en Lima y envios por agencia a provincia.",
    value: "Rapido",
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
          <Card className="overflow-hidden border border-slate-200 bg-[radial-gradient(1200px_500px_at_90%_-10%,#dbeafe_0%,transparent_55%),radial-gradient(900px_420px_at_-10%_120%,#dcfce7_0%,transparent_50%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] panel-soft-hover">
            <CardBody className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] md:p-8 p-5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info" className="w-fit rounded-xl">Retail peruano oficial</Badge>
                  <Badge tone="success" className="w-fit rounded-xl">Atencion real post-venta</Badge>
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl md:text-5xl font-display font-bold leading-[1.02] text-slate-900">
                    Estilo real para
                    <br />
                    calle y deporte
                  </h1>
                  <p className="text-slate-600 max-w-xl text-[15px] md:text-base">
                    Compra zapatillas y ropa con una experiencia clara, rapida y confiable. Tu pedido queda trazado de inicio a fin para que siempre sepas su estado.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <Link href="/catalog" className="btn-brand">Ver catalogo</Link>
                  <Link href="/track" className="btn-soft">Seguir mi pedido</Link>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 max-w-xl">
                  <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                    <p className="text-[11px] text-slate-500">Cupon</p>
                    <p className="text-sm font-semibold text-slate-900">{homePromo.couponCode}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                    <p className="text-[11px] text-slate-500">Envio gratis</p>
                    <p className="text-sm font-semibold text-slate-900">Desde S/{homePromo.freeShippingFrom}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                    <p className="text-[11px] text-slate-500">Seguimiento</p>
                    <p className="text-sm font-semibold text-slate-900">En tiempo real</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-blue-100/60 via-sky-100/40 to-emerald-100/55 blur-2xl" />
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 md:p-5 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-900 text-white p-5">
                    <p className="text-[11px] uppercase tracking-wide text-slate-300">Coleccion destacada</p>
                    <p className="mt-2 text-2xl font-display font-bold">ODERA 05</p>
                    <p className="mt-1 text-sm text-slate-200">Nuevos ingresos en zapatillas urbanas y deportivas.</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <span className="rounded-lg bg-white/10 px-2 py-1">Stock validado</span>
                      <span className="rounded-lg bg-white/10 px-2 py-1">Pago confirmado</span>
                      <span className="rounded-lg bg-white/10 px-2 py-1">Canales oficiales</span>
                      <span className="rounded-lg bg-white/10 px-2 py-1">Compra segura</span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {trustItems.map((item) => (
                      <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          <p className="text-xs text-slate-600 mt-0.5">{item.desc}</p>
                        </div>
                        <span className="text-xs font-semibold rounded-lg border border-slate-300 px-2 py-1 text-slate-700 bg-white">{item.value}</span>
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
