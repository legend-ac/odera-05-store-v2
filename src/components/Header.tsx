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
        "text-sm px-3 py-2 rounded-xl transition-colors",
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
      ].join(" ")}
    >
      {children}
    </Link>
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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
      <Container className="py-3 flex items-center justify-between gap-3 md:gap-5">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-slate-100/70">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white grid place-items-center text-xs font-bold shadow-sm">O5</span>
          <span className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight text-slate-900 whitespace-nowrap">ODERA 05 STORE</span>
            <span className="hidden lg:block text-[11px] text-slate-500">Tienda oficial online</span>
          </span>
        </Link>

        <form onSubmit={submitSearch} className="hidden md:flex items-center gap-2 w-full max-w-xl">
          <div className="relative w-full">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nombre o marca..." className="pl-9" />
          </div>
          <button type="submit" className="btn-soft px-4 py-2.5 rounded-xl">Buscar</button>
        </form>

        <button
          type="button"
          aria-label="Abrir menu"
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-700"
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <nav className="hidden md:flex items-center gap-1.5">
          <NavLink href="/catalog">Catalogo</NavLink>
          <NavLink href="/track">Mis pedidos</NavLink>
          <Link href="/cart" className="relative text-sm px-3 py-2 rounded-xl border border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 font-medium">
            Carrito
            {count > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] grid place-items-center shadow-sm">
                {count}
              </span>
            ) : null}
          </Link>
        </nav>
      </Container>

      {open ? (
        <div className="md:hidden border-t border-slate-200/80 bg-white">
          <Container className="py-3 flex flex-col gap-2">
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos..." />
              <button type="submit" className="btn-soft px-4 py-2.5">Buscar</button>
            </form>
            <Link href="/catalog" className="chip-link" onClick={() => setOpen(false)}>Catalogo</Link>
            <Link href="/track" className="chip-link" onClick={() => setOpen(false)}>Mis pedidos</Link>
            <Link href="/cart" className="chip-link" onClick={() => setOpen(false)}>
              Carrito {count > 0 ? `(${count})` : ""}
            </Link>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
