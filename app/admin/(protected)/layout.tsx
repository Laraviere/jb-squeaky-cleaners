import { AdminShell } from "@/components/admin/shell";
import { requireAdmin } from "@/lib/admin/server";
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { identity } = await requireAdmin();
  return <AdminShell role={identity!.role}>{children}</AdminShell>;
}
