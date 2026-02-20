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
        "text-sm px-3 py-2 rounded-lg border transition-colors whitespace-nowrap",
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900",
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
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-md bg-slate-900 text-white grid place-items-center text-xs font-bold">A</span>
            <div>
              <p className="font-semibold text-slate-900 leading-none">Panel de administración</p>
              <p className="text-xs text-slate-500 mt-1">Gestión de productos, pedidos y tienda</p>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="text-xs text-slate-600 truncate max-w-[180px] sm:max-w-none">{email}</div>
            <button
              type="button"
              onClick={logout}
              className="text-sm px-3 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4 md:py-6 grid lg:grid-cols-[240px_1fr] gap-4 md:gap-6">
        <aside className="panel p-2 h-fit">
          <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-1 lg:overflow-visible lg:pb-0">
            <NavItem href="/dashboard">Inicio</NavItem>
            <NavItem href="/dashboard/orders">Pedidos</NavItem>
            <NavItem href="/dashboard/products">Productos</NavItem>
            <NavItem href="/dashboard/settings">Configuracion</NavItem>
          </nav>
        </aside>

        <section className="panel p-3 md:p-5">{children}</section>
      </div>
    </div>
  );
}
