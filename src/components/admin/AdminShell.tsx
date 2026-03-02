"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={[
        "relative text-sm px-3 py-2.5 rounded-xl transition-all duration-150 whitespace-nowrap font-semibold border text-center lg:text-left overflow-hidden",
        active
          ? "bg-[var(--brand-50)] text-[var(--brand-700)] border-[var(--brand-100)] shadow-sm"
          : "bg-white text-slate-600 border-slate-200 hover:bg-[var(--surface-hover)] hover:border-slate-300 hover:text-slate-900",
      ].join(" ")}
    >
      {/* Left accent bar for active state */}
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[var(--brand-500)]" />
      )}
      {children}
    </Link>
  );
}

export default function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const adminInitial = email ? email[0]?.toUpperCase() ?? "A" : "A";

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
    <div className="min-h-dvh bg-[radial-gradient(1200px_620px_at_105%_-20%,rgba(45,138,58,.08),transparent_58%),linear-gradient(180deg,#f6f8fc_0%,#edf2f9_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-4 md:py-6 grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 h-fit shadow-[var(--shadow-elevated)]">
          <div className="rounded-xl border border-[var(--brand-100)] bg-gradient-to-r from-[var(--brand-50)] to-white p-3">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--brand-700)] to-[var(--brand-500)] text-xs font-bold text-white shadow-md ring-1 ring-white/20">05</span>
              <div>
                <p className="text-sm font-bold text-slate-900 leading-none">Panel ODERA 05</p>
                <p className="text-[11px] text-slate-500 mt-1">Gestión comercial</p>
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
          <header className="rounded-2xl border border-slate-200 bg-white p-3 md:px-5 md:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-[var(--shadow-card)]">
            <div>
              <p className="text-sm font-bold text-slate-900">Administración de tienda</p>
              <p className="text-xs text-slate-500 mt-0.5">Control de pedidos, productos, ventas y configuración.</p>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">→ {currentRoute}</p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Admin Avatar */}
              <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-muted)] border border-slate-200 pl-1.5 pr-3 py-1.5">
                <span className="grid place-items-center h-6 w-6 rounded-lg bg-[var(--brand-700)] text-white text-[10px] font-bold shrink-0">
                  {adminInitial}
                </span>
                <span className="text-xs text-slate-700 truncate max-w-[160px] font-medium">{email}</span>
              </div>
              <Button type="button" onClick={logout} variant="secondary" size="sm">
                Salir
              </Button>
            </div>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-6 shadow-[var(--shadow-card)]">{children}</section>
        </div>
      </div>
    </div>
  );
}
