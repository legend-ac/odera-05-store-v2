"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiPost, CSRF_COOKIE_NAME } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/dashboard/orders", label: "Pedidos" },
  { href: "/dashboard/inventory", label: "Inventario" },
  { href: "/dashboard/products", label: "Productos" },
  { href: "/dashboard/settings", label: "Configuracion" },
];

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "group relative flex min-h-10 items-center rounded-lg px-3 text-sm font-black transition",
        active
          ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-950",
      ].join(" ")}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-emerald-600" />}
      <span className="pl-1">{label}</span>
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
    <div className="min-h-dvh bg-[#eef3f9] text-slate-950">
      <div className="mx-auto grid max-w-[1680px] gap-4 px-3 py-3 md:px-5 md:py-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-lg border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:sticky lg:top-5">
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-slate-950 p-3 text-white">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-600 text-xs font-black">05</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-none">ODERA 05</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">Gestion comercial</p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV_ITEMS.map((item) => (
              <NavItem key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <header className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-950">Administracion de tienda</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Pedidos, catalogo, ventas y configuracion.</p>
              <p className="mt-1 font-mono text-[11px] text-slate-400">/ {currentRoute}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-1.5 pr-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-700 text-[10px] font-black text-white">
                  {adminInitial}
                </span>
                <span className="max-w-[190px] truncate text-xs font-bold text-slate-700">{email}</span>
              </div>
              <Button type="button" onClick={logout} variant="secondary" size="sm">
                Salir
              </Button>
            </div>
          </header>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
