export const runtime = "nodejs";
export const maxDuration = 60;

import AdminShell from "@/components/admin/AdminShell";
import { requireAdminSessionOrRedirect } from "@/lib/server/adminSession";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSessionOrRedirect();
  return <AdminShell email={session.email}>{children}</AdminShell>;
}
