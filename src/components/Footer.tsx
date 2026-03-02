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
    <footer className="mt-16 relative bg-slate-950 text-slate-400">
      {/* Gradient top divider */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />

      <Container className="py-12 grid md:grid-cols-4 gap-8 text-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-gradient-to-br from-[var(--brand-700)] to-[var(--brand-500)] text-white text-[10px] font-bold shadow-md ring-1 ring-white/10">O5</span>
            <p className="font-bold text-white tracking-tight">ODERA 05 STORE</p>
          </div>
          <p className="text-slate-500 text-xs leading-relaxed">Tienda peruana de zapatillas y ropa con atención por canales oficiales.</p>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400 w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
            Compra protegida y seguimiento claro
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-semibold text-white text-xs uppercase tracking-widest mb-1">Navegación</p>
          <Link href="/catalog" className="text-slate-500 hover:text-slate-200 transition-colors duration-150">Catálogo</Link>
          <Link href="/track" className="text-slate-500 hover:text-slate-200 transition-colors duration-150">Seguimiento</Link>
          <Link href="/cart" className="text-slate-500 hover:text-slate-200 transition-colors duration-150">Carrito</Link>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-semibold text-white text-xs uppercase tracking-widest mb-1">Compra Segura</p>
          <p className="text-slate-500 text-xs leading-relaxed">Validación de pagos con confirmación manual.</p>
          <p className="text-slate-500 text-xs leading-relaxed">Stock y estado de pedido en tiempo real.</p>
          <p className="text-slate-500 text-xs leading-relaxed">Despachos a Lima y provincias.</p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-semibold text-white text-xs uppercase tracking-widest mb-1">Soporte</p>
          <p className="text-slate-500 text-xs leading-relaxed">Respuesta rápida por WhatsApp y redes oficiales.</p>
          <p className="text-slate-500 text-xs leading-relaxed">Seguimiento simple con número de pedido.</p>
        </div>
      </Container>

      <div className="border-t border-slate-800/60">
        <Container className="py-5 text-xs text-slate-600 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p>© {new Date().getFullYear()} ODERA 05 STORE. Todos los derechos reservados.</p>
          <p className="text-slate-700">Marca peruana en crecimiento.</p>
        </Container>
      </div>
    </footer>
  );
}
