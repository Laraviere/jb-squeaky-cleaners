import { redirect } from "next/navigation";
import { AuthShell } from "@/components/admin/auth-shell";
import { MfaForm } from "@/components/admin/auth-forms";
import { requireStaffEnrollment } from "@/lib/admin/server";
import { signOut } from "../actions";
export default async function MfaPage() {
  const { client } = await requireStaffEnrollment();
  const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") redirect("/admin");
  const factors = await client.auth.mfa.listFactors();
  return (
    <AuthShell title="Verify your account">
      <MfaForm
        factors={(factors.data?.totp || [])
          .filter((f) => f.status === "verified")
          .map((f) => ({ id: f.id, friendly_name: f.friendly_name }))}
      />
      <form action={signOut}>
        <button className="admin-text-button">Sign out</button>
      </form>
    </AuthShell>
  );
}
