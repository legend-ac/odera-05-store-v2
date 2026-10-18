"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import styles from "./StoreChrome.module.css";

const categories = [
  { href: "/catalog", label: "Todo el catálogo" },
  { href: "/catalog?type=zapatillas", label: "Zapatillas" },
  { href: "/catalog?type=ropa", label: "Ropa" },
  { href: "/catalog?type=accesorios", label: "Accesorios" },
];

function SearchIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path strokeLinecap="round" d="m16 16 5 5" /></svg>;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { items } = useCart();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  if (pathname === "/login" || pathname.startsWith("/dashboard")) return null;
  const count = items.reduce((sum, item) => sum + item.qty, 0);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = q.trim();
    const params = new URLSearchParams(pathname.startsWith("/catalog") ? window.location.search : "");
    if (value) params.set("q", value);
    else params.delete("q");
    router.push(params.size ? `/catalog?${params}` : "/catalog");
    setSearchOpen(false);
    setOpen(false);
  }

  return (
    <header className={styles.header}>
      <div className={styles.headerMain}>
        <Link href="/" className={styles.brand} aria-label="ODERA 05 Store, inicio" onClick={() => { setOpen(false); setSearchOpen(false); }}>
          <span className={styles.mark}>05</span>
          <span className={styles.brandCopy}><strong>ODERA 05 STORE</strong><span>Zapatillas · Ropa · Accesorios</span></span>
        </Link>

        <form onSubmit={submitSearch} className={styles.desktopSearch} role="search" aria-label="Buscar en la tienda">
          <SearchIcon />
          <input aria-label="Buscar productos" placeholder="¿Qué estás buscando?" value={q} onChange={event => setQ(event.target.value)} />
          <button type="submit">Buscar</button>
        </form>

        <div className={styles.actions}>
          <Link href="/track" className={styles.orders}>Mis pedidos</Link>
          <button type="button" className={`${styles.iconButton} ${styles.mobileSearchToggle}`} aria-label="Buscar" aria-expanded={searchOpen} aria-controls="store-mobile-search" onClick={() => { setSearchOpen(value => !value); setOpen(false); }}><SearchIcon /></button>
          <Link href="/cart" className={styles.cart} aria-label={count ? `Carrito, ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16 9V7a4 4 0 0 0-8 0v2m-3 0h14l1 12H4L5 9Z" /></svg>
            <span className={styles.cartLabel}>Carrito</span>
            {count > 0 && <span className={styles.cartCount}>{count}</span>}
          </Link>
          <button type="button" className={`${styles.iconButton} ${styles.menuToggle}`} aria-label="Menú" aria-expanded={open} aria-controls="store-mobile-menu" onClick={() => { setOpen(value => !value); setSearchOpen(false); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">{open ? <path strokeLinecap="round" d="m6 6 12 12M6 18 18 6" /> : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>

      <div className={styles.navigationBar}>
        <div className={styles.navigationInner}>
          <nav aria-label="Categorías de la tienda" className={styles.categories}>
            {categories.map(category => <Link key={category.href} href={category.href} onClick={() => { setOpen(false); setSearchOpen(false); }}>{category.label}</Link>)}
          </nav>
          <Link href="/nosotros" className={styles.visit}>Visítanos en Independencia <span aria-hidden="true">↗</span></Link>
        </div>
      </div>

      {searchOpen && <form id="store-mobile-search" role="search" aria-label="Buscar productos en celular" onSubmit={submitSearch} className={styles.mobileSearch}>
        <label htmlFor="store-search-mobile" className="sr-only">Buscar productos</label>
        <input id="store-search-mobile" placeholder="Buscar zapatillas, ropa, marca…" value={q} onChange={event => setQ(event.target.value)} autoFocus />
        <button type="submit">Buscar</button>
      </form>}
      {open && <nav id="store-mobile-menu" aria-label="Menú principal" className={styles.mobileMenu}>
        {[{ href: "/", label: "Inicio" }, { href: "/catalog", label: "Catálogo" }, { href: "/track", label: "Mis pedidos" }, { href: "/nosotros", label: "Nuestra tienda" }].map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}<span aria-hidden="true">↗</span></Link>)}
      </nav>}
    </header>
  );
}
