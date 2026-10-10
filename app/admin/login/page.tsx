import Link from "next/link";
import { AuthShell } from "@/components/admin/auth-shell";
import { LoginForm } from "@/components/admin/auth-forms";
import { adminConfiguration } from "@/lib/admin/config";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <AuthShell title="Staff sign in">
      <p>
        Access is by invitation only. An active staff membership and
        authenticator verification are required.
      </p>
      {reason === "password-saved" && <p role="status">Password saved. Sign in with your new password, then verify your authenticator.</p>}
      {reason && reason !== "password-saved" && (
        <p role="alert" className="admin-error">
          {reason === "invite"
            ? "This invitation could not be verified. Contact your administrator."
            : "Your account does not have access to this portal."}
        </p>
      )}
      {adminConfiguration() ? (
        <LoginForm />
      ) : (
        <p role="alert">
          Admin authentication is not configured. Contact your administrator.
        </p>
      )}
      <Link href="/admin/forgot-password" className="admin-text-button">Forgot Password?</Link>
    </AuthShell>
  );
}
