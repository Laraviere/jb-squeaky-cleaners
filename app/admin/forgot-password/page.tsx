import Link from "next/link";
import { AuthShell } from "@/components/admin/auth-shell";
import { RecoveryForm } from "@/components/admin/auth-forms";
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return <AuthShell title="Reset your staff password">
    <p>Enter your staff email address. Password recovery does not create staff access.</p>
    {reason && <p role="alert" className="admin-error">Recovery could not be completed. Request a new link and try again.</p>}
    <RecoveryForm />
    <Link className="admin-text-button" href="/admin/login">Back to sign in</Link>
  </AuthShell>;
}
