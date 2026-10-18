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
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`admin-nav-item group relative flex min-h-11 items-center gap-3 px-3 text-sm font-bold transition ${active ? "is-active" : ""}`}
    >
      <span className="admin-nav-index" aria-hidden="true">{short}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const adminInitial = email ? email[0]?.toUpperCase() ?? "A" : "A";

  async function logout() {
    if (!window.dispatchEvent(new Event("odera:before-admin-leave", { cancelable: true }))) return;
    try {
      await apiPost("/api/admin/session-logout", {}, { csrfCookieName: CSRF_COOKIE_NAME });
    } catch (e) {
      console.warn(e);
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const currentRoute = NAV_GROUPS.flatMap((group) => group.items).find((item) =>
    item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/")
  )?.label ?? "Administración";

  return (
    <div className="admin-shell min-h-dvh">
      <div className="admin-layout mx-auto grid gap-5 px-4 py-4 md:px-6 md:py-6 lg:grid-cols-[218px_minmax(0,1fr)]">
        <aside className="admin-sidebar h-fit p-3 lg:sticky lg:top-6" aria-label="Panel de administración">
          <Link href="/dashboard" className="admin-brand mb-5 flex items-center gap-3 p-3" aria-label="ODERA 05 Store, inicio de administración">
            <span className="grid h-11 w-11 shrink-0 place-items-center text-xs font-black">05</span>
            <div className="min-w-0">
              <p className="admin-brand__name">ODERA 05 STORE</p>
              <p className="admin-brand__caption">Administración</p>
            </div>
          </Link>

          <nav className="admin-nav" aria-label="Navegación del administrador">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="admin-nav-group">
                <p>{group.label}</p>
                {group.items.map((item) => <NavItem key={item.href} {...item} />)}
              </div>
            ))}
          </nav>
          <div className="admin-sidebar-note mt-6 hidden lg:block">
            Catálogo, pedidos y existencias.<br />Todo desde un mismo lugar.
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <header className="admin-topbar flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="admin-breadcrumb"><span>Administración</span><span aria-hidden="true">/</span><strong>{currentRoute}</strong></p>
            </div>
            <div className="admin-topbar__actions flex min-w-0 items-center gap-2.5">
              <Link href="/" target="_blank" rel="noopener noreferrer" className="admin-store-link">
                Ver tienda <span aria-hidden="true">↗</span>
              </Link>
              <div className="admin-user flex min-w-0 items-center gap-2 py-1.5 pl-1.5 pr-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center text-[10px] font-black text-white">
                  {adminInitial}
                </span>
                <span className="admin-user__email truncate text-xs font-bold" title={email}>{email}</span>
              </div>
              <Button type="button" onClick={logout} variant="secondary" size="sm" className="admin-logout">
                Salir
              </Button>
            </div>
          </header>

          <div className="admin-workspace min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
