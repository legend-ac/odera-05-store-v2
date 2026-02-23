import Link from "next/link";
import FeaturedProducts from "@/components/FeaturedProducts";
import HomeSocialLinks from "@/components/HomeSocialLinks";
import { Card, CardBody } from "@/components/ui/card";
import { Container, Section } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { adminDb } from "@/lib/server/firebaseAdmin";

export const dynamic = "force-dynamic";

const trustItems = [
  { title: "Compra protegida", desc: "Confirmacion inmediata y seguimiento real del pedido.", icon: "shield" },
  { title: "Atencion humana", desc: "Soporte rapido por WhatsApp y redes oficiales.", icon: "chat" },
  { title: "Despacho nacional", desc: "Lima por delivery y provincia por agencia.", icon: "truck" },
  { title: "Pagos claros", desc: "Yape y Plin con validacion manual segura.", icon: "card" },
];

function TrustIcon({ name }: { name: string }) {
  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-700" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3 4 7v6c0 5 3.5 7.5 8 8 4.5-.5 8-3 8-8V7z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  if (name === "chat") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.3-4.3A8 8 0 1 1 21 12Z" />
      </svg>
    );
  }
  if (name === "truck") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-indigo-700" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-rose-700" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

export default async function HomePage() {
  let homePromoEnabled = true;
  try {
    const settingsSnap = await adminDb.doc("settings/store").get();
    if (settingsSnap.exists) {
      homePromoEnabled = Boolean(settingsSnap.data()?.homePromoEnabled ?? true);
    }
  } catch {
    homePromoEnabled = true;
  }

  return (
    <Container className="py-7 md:py-10">
      <div className="flex flex-col gap-8 md:gap-10">
        <Section className="py-0">
          <Card className="overflow-hidden border border-slate-200 bg-[radial-gradient(circle_at_top_left,_#f0f9ff,_#f8fafc_40%,_#ffffff)]">
            <CardBody className="grid gap-8 md:grid-cols-[1.35fr_1fr] md:p-8 p-5">
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info" className="w-fit">Retail peruano oficial</Badge>
                  <Badge tone="success" className="w-fit">Atencion real</Badge>
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl md:text-5xl font-bold leading-[1.05] text-slate-900">ODERA 05 STORE</h1>
                  <p className="text-slate-600 max-w-xl text-[15px] md:text-base">
                    Compra zapatillas y ropa con una experiencia clara, moderna y segura. Tu pedido queda registrado en
                    tiempo real para que siempre sepas en que estado esta.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link href="/catalog" className="btn-brand">Ver catalogo</Link>
                  <Link href="/track" className="btn-soft">Seguir mi pedido</Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                  <Badge tone="success" className="justify-center rounded-xl">Pago confirmado</Badge>
                  <Badge tone="info" className="justify-center rounded-xl">Atencion por WhatsApp</Badge>
                  <Badge tone="default" className="justify-center rounded-xl">Seguimiento simple</Badge>
                  <Badge tone="sale" className="justify-center rounded-xl">Promos activas</Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                  <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                    <p className="text-xs text-slate-500">Entrega</p>
                    <p className="text-sm font-semibold text-slate-900">Lima y provincias</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                    <p className="text-xs text-slate-500">Estado</p>
                    <p className="text-sm font-semibold text-slate-900">Seguimiento real</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                    <p className="text-xs text-slate-500">Validacion</p>
                    <p className="text-sm font-semibold text-slate-900">Pago manual seguro</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
                    <p className="text-xs text-slate-500">Atencion</p>
                    <p className="text-sm font-semibold text-slate-900">Canales oficiales</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {trustItems.map((item) => (
                  <Card key={item.title} className="shadow-none border-slate-200 bg-white/90">
                    <CardBody className="p-4 flex items-start gap-3">
                      <div className="mt-0.5"><TrustIcon name={item.icon} /></div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-600">{item.desc}</p>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </CardBody>
          </Card>
        </Section>

        <Section className="py-0">
          <Card className="bg-white border border-slate-200">
            <CardBody className="p-4 md:p-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 7 9 18l-5-5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Compra con respaldo real</p>
                  <p className="text-xs md:text-sm text-slate-600">Seguimiento del pedido, validacion manual y atencion directa.</p>
                </div>
              </div>
              <Link href="/track" className="btn-soft w-fit">Consultar mi pedido</Link>
            </CardBody>
          </Card>
        </Section>

        {homePromoEnabled ? (
          <Section className="py-0">
            <Card className="bg-gradient-to-r from-emerald-50 via-white to-sky-50">
              <CardBody className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Promocion activa</p>
                  <p className="text-sm text-slate-700">
                    Usa el cupon <b>ODERA10</b> y recibe 10% de descuento.
                  </p>
                </div>
                <div className="text-sm text-slate-700">
                  Envio gratis por compras desde <b>S/ 200</b>.
                </div>
              </CardBody>
            </Card>
          </Section>
        ) : null}

        <Section className="py-0 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Destacados</h2>
              <p className="text-sm text-slate-600">Productos recomendados por nuestros clientes.</p>
            </div>
            <Link href="/catalog" className="text-sm text-slate-700 hover:text-slate-900">Ver catalogo completo</Link>
          </div>
          <FeaturedProducts />
        </Section>

        <HomeSocialLinks />
      </div>
    </Container>
  );
}
