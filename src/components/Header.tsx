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
    <span className="relative grid place-items-center h-9 w-9 rounded-xl bg-gradient-to-br from-[var(--brand-700)] to-[var(--brand-500)] text-white font-bold text-[11px] shadow-[0_8px_22px_rgba(31,77,31,0.35)] md:h-10 md:w-10 md:text-xs">
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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
      <Container className="py-1.5 md:py-2">
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 md:grid-cols-[auto_1fr_auto] md:gap-2">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <BrandMark />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold tracking-tight text-slate-900 md:text-[15px]">ODERA 05 STORE</span>
              <span className="hidden md:block text-[11px] text-slate-500">Tienda oficial de zapatillas y ropa</span>
            </span>
          </Link>

          <form onSubmit={submitSearch} className="hidden md:flex items-center gap-2 min-w-0">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, marca o categoria..." uiSize="sm" className="md:min-h-11" />
            <Button type="submit" variant="secondary" size="md">Buscar</Button>
          </form>

          <div className="flex items-center gap-1.5 justify-self-end">
            <nav className="hidden lg:flex items-center gap-3 mr-1">
              <NavLink href="/catalog">Catalogo</NavLink>
              <NavLink href="/track">Mis pedidos</NavLink>
            </nav>
            <Link href="/cart" className="relative inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Carrito
              {count > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[var(--brand-600)] text-white text-[11px] grid place-items-center shadow-sm">
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos..." uiSize="sm" className="md:min-h-11" />
          <Button type="submit" variant="secondary" size="md">Buscar</Button>
        </form>

        {open ? (
          <div className="md:hidden mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
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
