import Link from "next/link";
import FeaturedProducts from "@/components/FeaturedProducts";
import HomeSocialLinks from "@/components/HomeSocialLinks";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col gap-10">
      <section className="panel p-6 md:p-10 bg-gradient-to-br from-white via-slate-50 to-emerald-50">
        <div className="grid md:grid-cols-[1.3fr_1fr] gap-8 items-center">
          <div className="flex flex-col gap-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tienda Oficial</p>
            <h1 className="text-3xl md:text-5xl font-semibold leading-tight">ODERA 05 STORE</h1>
            <p className="text-slate-700 max-w-xl">
              Productos seleccionados para ti, compra segura y atencion rapida por nuestros canales oficiales.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/catalog" className="btn-brand">Ver catálogo</Link>
              <Link href="/track" className="btn-soft">Seguir mi pedido</Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="panel p-4">
              <p className="text-xs text-slate-500">Atención</p>
              <p className="text-sm font-semibold mt-1">Asesoria por canales oficiales</p>
            </div>
            <div className="panel p-4">
              <p className="text-xs text-slate-500">Compra protegida</p>
              <p className="text-sm font-semibold mt-1">Confirmacion inmediata de pedido</p>
            </div>
            <div className="panel p-4 col-span-2">
              <p className="text-xs text-slate-500">Cobertura</p>
              <p className="text-sm font-semibold mt-1">Atencion para clientes en todo el Peru</p>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-4 md:p-5 bg-gradient-to-r from-emerald-50 via-white to-sky-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Promocion de bienvenida</p>
          <p className="text-sm text-slate-700">
            Usa el cupon <b>ODERA10</b> y recibe 10% de descuento en tus productos.
          </p>
        </div>
        <div className="text-sm text-slate-700">
          Envio gratis por compras desde <b>S/ 200</b>.
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Destacados</h2>
            <p className="text-sm text-slate-600">Lo mas pedido de la semana.</p>
          </div>
          <Link href="/catalog" className="text-sm text-slate-700 hover:text-slate-900">Ver catálogo completo</Link>
        </div>
        <FeaturedProducts />
      </section>

      <HomeSocialLinks />

      <section className="panel p-5 text-sm text-slate-600">
        <p>Si tienes dudas sobre tallas, envios o pagos, te ayudamos por WhatsApp o redes oficiales.</p>
      </section>
    </div>
  );
}
