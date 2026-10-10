import { AuthShell } from "@/components/admin/auth-shell";
import { PasswordForm } from "@/components/admin/auth-forms";
import { requireStaffEnrollment } from "@/lib/admin/server";
export default async function SetupPage() {
  await requireStaffEnrollment();
  return (
    <AuthShell title="Set your staff password">
      <PasswordForm />
    </AuthShell>
  );
}
