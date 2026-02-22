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
    <footer className="border-t border-slate-200 bg-white/95">
      <Container className="py-10 grid md:grid-cols-3 gap-8 text-sm">
        <div className="flex flex-col gap-2">
          <p className="font-bold text-slate-900">ODERA 05 STORE</p>
          <p className="text-slate-600">Tienda peruana con experiencia retail y atencion por canales oficiales.</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-bold text-slate-900">Navegacion</p>
          <Link href="/catalog" className="text-slate-600 hover:text-slate-900">Catalogo</Link>
          <Link href="/track" className="text-slate-600 hover:text-slate-900">Seguimiento</Link>
          <Link href="/cart" className="text-slate-600 hover:text-slate-900">Carrito</Link>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-bold text-slate-900">Compra segura</p>
          <p className="text-slate-600">Validacion de pagos con confirmacion manual.</p>
          <p className="text-slate-600">Stock y estado de pedido en tiempo real.</p>
          <p className="text-slate-600">Despachos a Lima y provincias.</p>
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
