"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/fields";
import { Badge } from "@/components/ui/badge";
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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="border-b border-slate-100 bg-slate-50">
        <Container className="py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="success">Envio gratis desde S/200</Badge>
            <Badge tone="info">Compra segura y seguimiento real</Badge>
            <Badge tone="default">Atencion directa por WhatsApp</Badge>
          </div>
        </Container>
      </div>

      <Container className="py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-md bg-slate-900 text-white grid place-items-center text-xs font-bold">O5</span>
          <span className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight text-slate-900">ODERA 05 STORE</span>
            <span className="hidden sm:block text-[11px] text-slate-500">Retail online oficial</span>
          </span>
        </Link>

        <form onSubmit={submitSearch} className="hidden md:flex items-center gap-2 w-full max-w-md">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos..." />
          <button type="submit" className="btn-soft px-4 py-2.5">Buscar</button>
        </form>

        <button
          type="button"
          aria-label="Abrir menu"
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 text-slate-700"
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink href="/catalog">Catalogo</NavLink>
          <NavLink href="/track">Mis pedidos</NavLink>
          <Link href="/cart" className="relative text-sm px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-100">
            Carrito
            {count > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] grid place-items-center">
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
