"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Container } from "@/components/ui/layout";

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <footer className="mt-10 border-t border-slate-200 bg-white/95">
      <Container className="py-10 grid md:grid-cols-4 gap-8 text-sm">
        <div className="flex flex-col gap-3">
          <p className="font-bold text-slate-900">ODERA 05 STORE</p>
          <p className="text-slate-600">Tienda peruana de zapatillas y ropa con atención por canales oficiales.</p>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 w-fit">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Compra protegida y seguimiento claro
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-bold text-slate-900">Navegación</p>
          <Link href="/catalog" className="text-slate-600 hover:text-slate-900">Catálogo</Link>
          <Link href="/track" className="text-slate-600 hover:text-slate-900">Seguimiento</Link>
          <Link href="/cart" className="text-slate-600 hover:text-slate-900">Carrito</Link>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-bold text-slate-900">Compra segura</p>
          <p className="text-slate-600">Validación de pagos con confirmación manual.</p>
          <p className="text-slate-600">Stock y estado de pedido en tiempo real.</p>
          <p className="text-slate-600">Despachos a Lima y provincias.</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-bold text-slate-900">Soporte</p>
          <p className="text-slate-600">Respuesta rápida por WhatsApp y redes oficiales.</p>
          <p className="text-slate-600">Seguimiento simple con número de pedido.</p>
        </div>
      </Container>

      <div className="border-t border-slate-200">
        <Container className="py-4 text-xs text-slate-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p>© {new Date().getFullYear()} ODERA 05 STORE. Todos los derechos reservados.</p>
          <p>Marca peruana en crecimiento.</p>
        </Container>
      </div>
    </footer>
  );
}
