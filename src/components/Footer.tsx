"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/dashboard")) {
    return null;
  }

  return (
    <footer className="border-t border-slate-200 bg-white/80">
      <div className="mx-auto max-w-6xl px-4 py-10 grid md:grid-cols-3 gap-8 text-sm">
        <div className="flex flex-col gap-2">
          <p className="font-semibold text-slate-900">ODERA 05 STORE</p>
          <p className="text-slate-600">Tienda online oficial para clientes de Peru.</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-semibold text-slate-900">Navegación</p>
          <Link href="/catalog" className="text-slate-600 hover:text-slate-900">Catálogo</Link>
          <Link href="/track" className="text-slate-600 hover:text-slate-900">Seguimiento</Link>
          <Link href="/cart" className="text-slate-600 hover:text-slate-900">Carrito</Link>
        </div>

        <div className="flex flex-col gap-2">
          <p className="font-semibold text-slate-900">Información</p>
          <p className="text-slate-600">Atencion por canales oficiales.</p>
          <p className="text-slate-600">Compra segura y seguimiento de pedido.</p>
          <p className="text-slate-600">Soporte rapido antes y despues de tu compra.</p>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-slate-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p>© {new Date().getFullYear()} ODERA 05 STORE. Todos los derechos reservados.</p>
          <p>Marca peruana en crecimiento.</p>
        </div>
      </div>
    </footer>
  );
}
