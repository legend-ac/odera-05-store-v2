"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/fields";
import { Container } from "@/components/ui/layout";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={[
        "text-[15px] px-2 py-2 transition-colors border-b-2",
        active ? "text-slate-900 border-[var(--brand-500)] font-semibold" : "text-slate-600 border-transparent hover:text-slate-900",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function BrandMark() {
  return (
    <span className="relative grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand-700)] to-[var(--brand-500)] text-white font-bold text-xs shadow-[0_8px_22px_rgba(31,77,31,0.35)]">
      <span className="absolute inset-1 rounded-lg border border-white/30" />
      O5
    </span>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { items } = useCart();
  if (pathname === "/login" || pathname.startsWith("/dashboard")) {
    return null;
  }

  const count = items.reduce((acc, x) => acc + x.qty, 0);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const value = q.trim();
    if (!value) {
      router.push("/catalog");
      return;
    }
    router.push(`/catalog?q=${encodeURIComponent(value)}`);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
      <Container className="py-2.5 md:py-3">
        <div className="grid grid-cols-[1fr_auto] md:grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <BrandMark />
            <span className="min-w-0">
              <span className="block text-sm md:text-base font-semibold tracking-tight text-slate-900 truncate">ODERA 05 STORE</span>
              <span className="hidden md:block text-[11px] text-slate-500">Tienda oficial de zapatillas y ropa</span>
            </span>
          </Link>

          <form onSubmit={submitSearch} className="hidden md:flex items-center gap-2 w-full max-w-2xl justify-self-center">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nombre, marca o categoría..." className="h-11" />
            <button type="submit" className="btn-soft px-4 h-11">Buscar</button>
          </form>

          <div className="flex items-center gap-2 justify-self-end">
            <nav className="hidden lg:flex items-center gap-3 mr-1">
              <NavLink href="/catalog">Catalogo</NavLink>
              <NavLink href="/track">Mis pedidos</NavLink>
            </nav>
            <Link href="/cart" className="relative inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 h-10 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Carrito
              {count > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[var(--brand-600)] text-white text-[11px] grid place-items-center shadow-sm">
                  {count}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              aria-label="Abrir menu"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-700"
              onClick={() => setOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>

        {open ? (
          <div className="lg:hidden mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos..." />
              <button type="submit" className="btn-soft px-4 py-2.5">Buscar</button>
            </form>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/catalog" className="chip-link justify-center" onClick={() => setOpen(false)}>Catalogo</Link>
              <Link href="/track" className="chip-link justify-center" onClick={() => setOpen(false)}>Mis pedidos</Link>
              <Link href="/cart" className="chip-link justify-center col-span-2" onClick={() => setOpen(false)}>
                Carrito {count > 0 ? `(${count})` : ""}
              </Link>
            </div>
          </div>
        ) : null}
      </Container>
    </header>
  );
}
