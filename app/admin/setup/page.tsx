import { recoverySession } from "@/lib/admin/recovery";
import { AuthShell } from "@/components/admin/auth-shell";
import { PasswordForm, MfaForm } from "@/components/admin/auth-forms";
import { requireStaffEnrollment } from "@/lib/admin/server";
export default async function SetupPage() {
  const { client } = await requireStaffEnrollment(true);
  const session = await recoverySession(client);
  if (session.recovery) {
    const factors = await client.auth.mfa.listFactors();
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (factors.error || assurance.error) throw new Error("Unable to verify account protection.");
    const verified = factors.data.totp.filter(f => f.status === "verified");
    if (verified.length && assurance.data.currentLevel !== "aal2")
      return <AuthShell title="Verify your existing authenticator">
        <p>Your account already has MFA. Verify it before changing your password. You will sign in and verify again after saving the new password.</p>
        <MfaForm recovery factors={verified.map(f => ({ id: f.id, friendly_name: f.friendly_name }))} />
      </AuthShell>;
  }
  return (
    <AuthShell title="Set your staff password">
      <PasswordForm />
    </AuthShell>
  );
}
