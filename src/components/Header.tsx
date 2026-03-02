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
        "relative text-[15px] px-2 py-2 transition-colors duration-150",
        "after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:rounded-full after:transition-all after:duration-200",
        active
          ? "text-slate-900 font-semibold after:bg-[var(--brand-500)] after:opacity-100"
          : "text-slate-600 hover:text-slate-900 after:bg-[var(--brand-500)] after:opacity-0 hover:after:opacity-50",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

function BrandMark() {
  return (
    <span className="relative grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--brand-700)] via-[var(--brand-600)] to-[var(--brand-400)] text-white font-bold text-[11px] shadow-[0_6px_20px_rgba(22,78,32,0.45)] md:h-10 md:w-10 md:text-xs ring-1 ring-white/20">
      <span className="absolute inset-[3px] rounded-lg border border-white/25" />
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
    if (pathname.startsWith("/catalog")) {
      const next = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      if (value) next.set("q", value);
      else next.delete("q");
      const qs = next.toString();
      router.push(qs ? `/catalog?${qs}` : "/catalog");
      setOpen(false);
      return;
    }
    if (!value) router.push("/catalog");
    else router.push(`/catalog?q=${encodeURIComponent(value)}`);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/88 backdrop-blur-xl shadow-[0_1px_12px_rgba(15,23,42,0.06)]">
      <Container className="py-1.5 md:py-2">
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 md:grid-cols-[auto_1fr_auto] md:gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 outline-none">
            <BrandMark />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold tracking-tight text-slate-900 md:text-[15px]">ODERA 05 STORE</span>
              <span className="hidden md:block text-[11px] text-slate-400 font-normal">Tienda oficial de zapatillas y ropa</span>
            </span>
          </Link>

          <form onSubmit={submitSearch} className="hidden md:flex items-center gap-2 min-w-0">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, marca o categoria..." uiSize="sm" className="pl-9 md:min-h-11 bg-[var(--surface-muted)] border-[var(--border-subtle)] focus-visible:bg-white" />
            </div>
            <Button type="submit" variant="secondary" size="md">Buscar</Button>
          </form>

          <div className="flex items-center gap-1.5 justify-self-end">
            <nav className="hidden lg:flex items-center gap-3 mr-1">
              <NavLink href="/catalog">Catalogo</NavLink>
              <NavLink href="/track">Mis pedidos</NavLink>
            </nav>
            <Link
              href="/cart"
              className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-[var(--surface-hover)] hover:border-slate-300 hover:shadow transition-all duration-150 active:scale-[0.97]"
            >
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="hidden sm:inline">Carrito</span>
              {count > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-[var(--brand-500)] text-white text-[10px] font-bold grid place-items-center shadow-[0_2px_8px_rgba(22,78,32,0.4)] ring-2 ring-white">
                  {count}
                </span>
              ) : null}
            </Link>
            <Button
              type="button"
              aria-label="Abrir menu"
              variant="secondary"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </Button>
          </div>
        </div>

        <form onSubmit={submitSearch} className="mt-1.5 flex items-center gap-2 md:hidden">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos..." uiSize="sm" className="pl-9 bg-[var(--surface-muted)] border-[var(--border-subtle)] focus-visible:bg-white" />
          </div>
          <Button type="submit" variant="secondary" size="md">Buscar</Button>
        </form>

        {open ? (
          <div className="md:hidden mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-elevated)] fade-in">
            <div className="grid grid-cols-2 gap-2">
              <Link href="/catalog" className="chip-link justify-center" onClick={() => setOpen(false)}>Catalogo</Link>
              <Link href="/track" className="chip-link justify-center" onClick={() => setOpen(false)}>Mis pedidos</Link>
              <Link href="/" className="chip-link justify-center col-span-2" onClick={() => setOpen(false)}>Inicio</Link>
            </div>
          </div>
        ) : null}
      </Container>
    </header>
  );
}
