"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={[
        "relative border-b-2 px-2 py-2 text-sm font-medium transition-colors duration-150",
        active
          ? "border-zinc-950 text-zinc-950 font-semibold"
          : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-950",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function BrandMark() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center bg-zinc-950 text-[11px] font-bold text-white md:h-10 md:w-10 md:text-xs">
      O5
    </span>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const { items } = useCart();

  if (pathname === "/login" || pathname.startsWith("/dashboard")) {
    return null;
  }

  const count = items.reduce((acc, x) => acc + x.qty, 0);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const value = q.trim();
    if (pathname.startsWith("/catalog")) {
      const next = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      if (value) next.set("q", value);
      else next.delete("q");
      const qs = next.toString();
      router.push(qs ? `/catalog?${qs}` : "/catalog");
      setSearchOpen(false);
      setOpen(false);
      return;
    }
    if (!value) router.push("/catalog");
    else router.push(`/catalog?q=${encodeURIComponent(value)}`);
    setSearchOpen(false);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
      <Container className="py-3">
        <div className="flex items-center gap-2 md:gap-3">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 outline-none shrink-0">
            <BrandMark />
            <span className="hidden sm:block min-w-0">
              <span className="block text-[13px] font-bold tracking-tight text-slate-900 md:text-[14px] leading-tight">ODERA 05 STORE</span>
              <span className="block text-[10px] text-slate-400 font-normal leading-tight">Zapatillas y ropa originales</span>
            </span>
          </Link>

          {/* Barra de búsqueda — desktop */}
          <form onSubmit={submitSearch} className="hidden md:flex items-center gap-2 flex-1 min-w-0 mx-2">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar zapatillas, ropa, marca..."
                uiSize="sm"
                className="pl-9 bg-[var(--surface-muted)] border-[var(--border-subtle)] focus-visible:bg-white"
              />
            </div>
            <Button type="submit" variant="secondary" size="md">Buscar</Button>
          </form>

          {/* Nav + Acciones */}
          <div className="flex items-center gap-1.5 ml-auto">

            {/* Nav links — solo en desktop */}
            <nav className="hidden lg:flex items-center gap-1 mr-2">
              <NavLink href="/catalog">Catálogo</NavLink>
              <NavLink href="/track">Mis pedidos</NavLink>
            </nav>

            {/* Botón búsqueda — solo mobile */}
            <button
              type="button"
              aria-label="Buscar"
              onClick={() => { setSearchOpen((v) => !v); setOpen(false); }}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all duration-150"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Carrito */}
            <Link
              href="/cart"
              className="relative inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-[var(--surface-hover)] hover:border-slate-300 hover:shadow transition-all duration-150 active:scale-[0.97]"
            >
              <svg className="h-4 w-4 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="hidden sm:inline text-[13px]">Carrito</span>
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-[var(--brand-500)] text-white text-[10px] font-bold grid place-items-center shadow-[0_2px_8px_rgba(22,78,32,0.4)] ring-2 ring-white">
                  {count}
                </span>
              )}
            </Link>

            {/* Menú hamburguesa — solo mobile */}
            <Button
              type="button"
              aria-label="Menú"
              variant="secondary"
              size="icon"
              className="lg:hidden"
              onClick={() => { setOpen((v) => !v); setSearchOpen(false); }}
            >
              {open ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </Button>
          </div>
        </div>

        {/* Panel de búsqueda mobile — expandible */}
        {searchOpen && (
          <form onSubmit={submitSearch} className="md:hidden mt-2 fade-in">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar productos..."
                  uiSize="sm"
                  autoFocus
                  className="pl-9 bg-[var(--surface-muted)] border-[var(--border-subtle)] focus-visible:bg-white"
                />
              </div>
              <Button type="submit" variant="secondary" size="md">Ir</Button>
            </div>
          </form>
        )}

        {/* Menú mobile desplegable */}
        {open && (
          <div className="lg:hidden mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-elevated)] fade-in">
            <div className="grid grid-cols-2 gap-2">
              <Link href="/catalog" className="chip-link justify-center text-sm" onClick={() => setOpen(false)}>
                <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Catálogo
              </Link>
              <Link href="/track" className="chip-link justify-center text-sm" onClick={() => setOpen(false)}>
                <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                </svg>
                Mis pedidos
              </Link>
              <Link href="/" className="chip-link justify-center col-span-2 text-sm" onClick={() => setOpen(false)}>Inicio</Link>
            </div>
          </div>
        )}
      </Container>
    </header>
  );
}
