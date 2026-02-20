"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { usePathname } from "next/navigation";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={[
        "text-sm px-3 py-2 rounded-md transition-colors",
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { items } = useCart();
  if (pathname === "/login" || pathname.startsWith("/dashboard")) {
    return null;
  }

  const count = items.reduce((acc, x) => acc + x.qty, 0);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-md bg-slate-900 text-white grid place-items-center text-xs font-bold">O5</span>
          <span className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight text-slate-900">ODERA 05 STORE</span>
            <span className="hidden sm:block text-[11px] text-slate-500">Tienda oficial en linea</span>
          </span>
        </Link>

        <button
          type="button"
          aria-label="Abrir menu"
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md border border-slate-200 text-slate-700"
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink href="/catalog">Catalogo</NavLink>
          <NavLink href="/track">Mis pedidos</NavLink>
          <NavLink href="/cart">Carrito ({count})</NavLink>
        </nav>
      </div>

      {open ? (
        <div className="md:hidden border-t border-slate-200/80 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2">
            <Link href="/catalog" className="chip-link" onClick={() => setOpen(false)}>Catalogo</Link>
            <Link href="/track" className="chip-link" onClick={() => setOpen(false)}>Mis pedidos</Link>
            <Link href="/cart" className="chip-link" onClick={() => setOpen(false)}>Carrito ({count})</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
