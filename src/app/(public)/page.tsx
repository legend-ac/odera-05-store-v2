import Link from "next/link";
import FeaturedProducts from "@/components/FeaturedProducts";
import HomeSocialLinks from "@/components/HomeSocialLinks";
import { Card, CardBody } from "@/components/ui/card";
import { Container, Section } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const trustItems = [
  { title: "Compra protegida", desc: "Confirmacion inmediata y seguimiento real del pedido." },
  { title: "Atencion humana", desc: "Soporte rapido por WhatsApp y redes oficiales." },
  { title: "Despacho nacional", desc: "Lima por delivery y provincia por agencia." },
  { title: "Pagos claros", desc: "Yape y Plin con validacion manual segura." },
];

export default function HomePage() {
  return (
    <Container className="py-8 md:py-10">
      <div className="flex flex-col gap-8 md:gap-10">
        <Section className="py-0">
          <Card className="overflow-hidden bg-gradient-to-br from-white via-slate-50 to-blue-50">
            <CardBody className="grid gap-8 md:grid-cols-[1.35fr_1fr] md:p-8">
              <div className="flex flex-col gap-4">
                <Badge tone="info" className="w-fit">Retail peruano oficial</Badge>
                <h1 className="text-3xl md:text-5xl font-bold leading-tight text-slate-900">ODERA 05 STORE</h1>
                <p className="text-slate-600 max-w-xl text-[15px]">
                  Compra zapatillas y ropa con una experiencia clara, moderna y segura. Tu pedido queda registrado en
                  tiempo real para que siempre sepas en que estado esta.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link href="/catalog" className="btn-brand">Ver catalogo</Link>
                  <Link href="/track" className="btn-soft">Seguir mi pedido</Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                  <Badge tone="success" className="justify-center rounded-xl">Pago confirmado</Badge>
                  <Badge tone="info" className="justify-center rounded-xl">Atencion por WhatsApp</Badge>
                  <Badge tone="default" className="justify-center rounded-xl">Seguimiento simple</Badge>
                  <Badge tone="sale" className="justify-center rounded-xl">Promos activas</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {trustItems.map((item) => (
                  <Card key={item.title} className="shadow-none">
                    <CardBody className="p-4">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{item.desc}</p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </CardBody>
          </Card>
        </Section>

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
