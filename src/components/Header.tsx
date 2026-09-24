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
        "relative px-3 py-1.5 text-sm font-bold uppercase tracking-widest transition-all duration-150",
        active
          ? "text-[var(--vermeil)] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[var(--vermeil)]"
          : "text-[var(--ash)] hover:text-[var(--paper)] hover:after:absolute hover:after:bottom-0 hover:after:left-0 hover:after:right-0 hover:after:h-[2px] hover:after:bg-[var(--ash-2)]",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function BrandMark() {
  return (
    <span
      className="relative grid shrink-0 place-items-center text-[11px] font-black text-white"
      style={{
        width: 38,
        height: 38,
        background: "var(--vermeil)",
        clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
        letterSpacing: "0.06em",
      }}
    >
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
    <header
      className="sticky top-0 z-40"
      style={{
        background: "rgba(14,14,18,0.95)",
        borderBottom: "1px solid var(--ash-2)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Vermeil accent line */}
      <div
        className="absolute top-0 inset-x-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, var(--vermeil) 40%, var(--gold) 60%, transparent 100%)",
        }}
      />

      <Container className="py-3">
        <div className="flex items-center gap-2 md:gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 outline-none shrink-0 group">
            <BrandMark />
            <span className="hidden sm:block min-w-0">
              <span
                className="block font-black tracking-tight leading-tight transition-colors duration-150 group-hover:text-[var(--vermeil)]"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: "15px",
                  letterSpacing: "0.12em",
                  color: "var(--paper)",
                }}
              >
                ODERA 05 STORE
              </span>
              <span
                className="block font-medium leading-tight"
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.22em",
                  color: "var(--ash)",
                  textTransform: "uppercase",
                }}
              >
                オデラ · Zapatillas Originales
              </span>
            </span>
          </Link>

          {/* Barra de búsqueda — desktop */}
          <form onSubmit={submitSearch} className="hidden md:flex items-center gap-2 flex-1 min-w-0 mx-3">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                style={{ color: "var(--ash)" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar zapatillas, ropa, marca..."
                uiSize="sm"
                className="pl-9"
                style={{
                  background: "var(--ink-3)",
                  border: "1px solid var(--ash-2)",
                  color: "var(--paper)",
                  borderRadius: "2px",
                }}
              />
            </div>
            <button
              type="submit"
              className="btn-brand text-xs px-4 py-2"
            >
              Buscar
            </button>
          </form>

          {/* Nav + Acciones */}
          <div className="flex items-center gap-1.5 ml-auto">

            {/* Nav links — solo en desktop */}
            <nav className="hidden lg:flex items-center gap-0.5 mr-3">
              <NavLink href="/catalog">Catálogo</NavLink>
              <NavLink href="/track">Pedidos</NavLink>
            </nav>

            {/* Botón búsqueda — solo mobile */}
            <button
              type="button"
              aria-label="Buscar"
              onClick={() => { setSearchOpen((v) => !v); setOpen(false); }}
              className="md:hidden inline-flex h-9 w-9 items-center justify-center transition-all duration-150"
              style={{
                background: "var(--ink-3)",
                border: "1px solid var(--ash-2)",
                borderRadius: "2px",
                color: "var(--ash)",
              }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Carrito */}
            <Link
              href="/cart"
              className="relative inline-flex h-9 items-center gap-2 px-3 text-sm font-bold uppercase tracking-wider transition-all duration-150 active:scale-[0.97] group"
              style={{
                background: "var(--ink-3)",
                border: "1px solid var(--ash-2)",
                borderRadius: "2px",
                color: "var(--paper)",
                letterSpacing: "0.08em",
                fontSize: "11px",
              }}
            >
              <svg
                className="h-4 w-4 shrink-0 transition-colors duration-150 group-hover:text-[var(--vermeil)]"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="hidden sm:inline">Carrito</span>
              {count > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 grid place-items-center text-[10px] font-black text-white ring-2"
                  style={{
                    background: "var(--vermeil)",
                    borderRadius: "1px",
                    boxShadow: "0 0 0 2px var(--ink), 0 0 8px rgba(232,69,44,0.6)",
                  }}
                >
                  {count}
                </span>
              )}
            </Link>

            {/* Menú hamburguesa — solo mobile */}
            <button
              type="button"
              aria-label="Menú"
              onClick={() => { setOpen((v) => !v); setSearchOpen(false); }}
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center transition-all duration-150"
              style={{
                background: "var(--ink-3)",
                border: "1px solid var(--ash-2)",
                borderRadius: "2px",
                color: "var(--paper)",
              }}
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
            </button>
          </div>
        </div>

        {/* Panel de búsqueda mobile — expandible */}
        {searchOpen && (
          <form onSubmit={submitSearch} className="md:hidden mt-3 fade-in">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: "var(--ash)" }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar productos..."
                  uiSize="sm"
                  autoFocus
                  className="pl-9"
                  style={{
                    background: "var(--ink-3)",
                    border: "1px solid var(--ash-2)",
                    color: "var(--paper)",
                    borderRadius: "2px",
                  }}
                />
              </div>
              <button type="submit" className="btn-brand text-xs px-4 py-2">Ir</button>
            </div>
          </form>
        )}

        {/* Menú mobile desplegable */}
        {open && (
          <div
            className="lg:hidden mt-3 p-3 fade-in"
            style={{
              background: "var(--ink-2)",
              border: "1px solid var(--ash-2)",
              borderRadius: "2px",
              boxShadow: "var(--shadow-elevated)",
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/catalog"
                className="chip-link justify-center text-sm"
                onClick={() => setOpen(false)}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Catálogo
              </Link>
              <Link
                href="/track"
                className="chip-link justify-center text-sm"
                onClick={() => setOpen(false)}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                </svg>
                Mis pedidos
              </Link>
              <Link
                href="/"
                className="chip-link justify-center col-span-2 text-sm"
                onClick={() => setOpen(false)}
              >
                Inicio
              </Link>
            </div>
          </div>
        )}
      </Container>
    </header>
  );
}
