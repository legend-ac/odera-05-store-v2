"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

const NAV_GROUPS = [
  { label: "Centro de control", items: [{ href: "/dashboard", label: "Inicio", short: "01" }] },
  { label: "Ventas", items: [{ href: "/dashboard/orders", label: "Pedidos", short: "02" }] },
  { label: "Catálogo", items: [{ href: "/dashboard/products", label: "Productos", short: "03" }, { href: "/dashboard/inventory", label: "Inventario", short: "04" }] },
  { label: "Tienda", items: [{ href: "/dashboard/settings", label: "Ajustes", short: "05" }] },
];

function NavItem({ href, label, short }: { href: string; label: string; short: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`admin-nav-item group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${active ? "is-active" : ""}`}
    >
      <span className="admin-nav-index">{short}</span>
      <span>{label}</span>
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
    <div className="admin-shell min-h-dvh text-slate-950">
      <div className="admin-layout mx-auto grid gap-5 px-4 py-4 md:px-6 md:py-6 lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="admin-sidebar h-fit p-3 lg:sticky lg:top-5">
          <div className="admin-brand mb-5 flex items-center gap-3 p-3 text-white">
            <span className="grid h-11 w-11 shrink-0 place-items-center text-xs font-black">05</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-none tracking-wide">ODERA 05 STORE</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-slate-300">Administración comercial</p>
            </div>
          </div>

          <nav className="admin-nav flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="admin-nav-group flex gap-1.5 lg:flex-col">
                <p>{group.label}</p>
                {group.items.map((item) => <NavItem key={item.href} {...item} />)}
              </div>
            ))}
          </nav>
          <div className="admin-sidebar-note mt-6 hidden lg:block">
            <span className="admin-live-dot" /> Sistema listo para operar
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <header className="admin-topbar flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">ODERA 05 / Administración</p>
              <p className="mt-1 text-lg font-black tracking-tight text-slate-950">{currentRoute}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <div className="admin-user flex min-w-0 items-center gap-2 py-1.5 pl-1.5 pr-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center text-[10px] font-black text-white">
                  {adminInitial}
                </span>
                <span className="max-w-[190px] truncate text-xs font-bold text-slate-700">{email}</span>
              </div>
              <Button type="button" onClick={logout} variant="secondary" size="sm" className="admin-logout">
                Salir
              </Button>
            </div>
          </header>

          <main className="admin-workspace min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
