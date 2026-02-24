"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={[
        "text-sm px-3 py-2.5 rounded-xl transition-all whitespace-nowrap font-medium",
        active
          ? "bg-white text-[var(--brand-700)] shadow-sm"
          : "text-white/85 hover:bg-white/12 hover:text-white",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export default function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const router = useRouter();

  async function logout() {
    try {
      await apiPost("/api/admin/session-logout", {}, { csrfCookieName: CSRF_COOKIE_NAME });
    } catch (e) {
      console.warn(e);
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(1100px_500px_at_0%_-20%,rgba(46,106,47,.13),transparent_55%),linear-gradient(180deg,#f5f8fd_0%,#edf3fb_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-4 md:py-6 grid gap-4 lg:grid-cols-[250px_1fr]">
        <aside className="rounded-2xl bg-gradient-to-b from-[var(--brand-700)] via-[var(--brand-600)] to-[var(--brand-500)] text-white p-3 md:p-4 h-fit shadow-[0_16px_36px_rgba(31,77,31,.35)]">
          <div className="flex items-center gap-3 pb-3 border-b border-white/20">
            <span className="grid place-items-center h-10 w-10 rounded-xl border border-white/35 bg-white/10 text-xs font-bold">O5</span>
            <div>
              <p className="text-sm font-semibold leading-none">Panel ODERA 05</p>
              <p className="text-[11px] text-white/80 mt-1">Gestion comercial</p>
            </div>
          </div>

          <nav className="mt-3 flex lg:flex-col gap-2 overflow-x-auto pb-1 lg:overflow-visible lg:pb-0">
            <NavItem href="/dashboard">Inicio</NavItem>
            <NavItem href="/dashboard/orders">Pedidos</NavItem>
            <NavItem href="/dashboard/products">Productos</NavItem>
            <NavItem href="/dashboard/settings">Configuracion</NavItem>
          </nav>
        </aside>

        <div className="flex flex-col gap-4">
          <header className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur p-3 md:px-4 md:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <div>
              <p className="text-sm font-semibold text-slate-900">Administracion de tienda</p>
              <p className="text-xs text-slate-500">Control de productos, pedidos y configuracion general.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-600 truncate max-w-[180px] bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5">{email}</div>
              <button type="button" onClick={logout} className="btn-soft">
                Salir
              </button>
            </div>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white/92 backdrop-blur p-3 md:p-5 shadow-[0_10px_26px_rgba(15,23,42,0.07)]">
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}

