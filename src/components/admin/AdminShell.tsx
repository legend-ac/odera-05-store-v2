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
        "text-sm px-3 py-2.5 rounded-xl transition-all whitespace-nowrap font-semibold border",
        active
          ? "bg-[var(--brand-100)] text-[var(--brand-700)] border-[var(--brand-500)] shadow-sm"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export default function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

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

  const currentRoute = pathname === "/dashboard" ? "Inicio" : pathname.replace("/dashboard/", "").replaceAll("/", " / ");

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_620px_at_105%_-20%,rgba(37,99,235,.08),transparent_58%),linear-gradient(180deg,#f6f8fc_0%,#edf2f8_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-4 md:py-6 grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 h-fit shadow-[0_12px_30px_rgba(15,23,42,.08)]">
          <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-[var(--brand-100)] to-white p-3">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center h-10 w-10 rounded-xl border border-[var(--brand-500)] bg-[var(--brand-700)] text-xs font-bold text-white">O5</span>
              <div>
                <p className="text-sm font-bold text-slate-900 leading-none">Panel ODERA 05</p>
                <p className="text-[11px] text-slate-600 mt-1">Gestion comercial diaria</p>
              </div>
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
          <header className="rounded-2xl border border-slate-200 bg-white p-3 md:px-4 md:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <div>
              <p className="text-sm font-semibold text-slate-900">Administracion de tienda</p>
              <p className="text-xs text-slate-500">Control de pedidos, productos, ventas y configuracion.</p>
              <p className="text-[11px] text-slate-400 mt-1">Ruta actual: {currentRoute}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-700 truncate max-w-[200px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">{email}</div>
              <button type="button" onClick={logout} className="btn-soft">
                Salir
              </button>
            </div>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5 shadow-[0_10px_28px_rgba(15,23,42,0.07)]">{children}</section>
        </div>
      </div>
    </div>
  );
}

