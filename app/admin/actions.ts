"use server";
import { headers } from "next/headers";
import { allowRecoveryRequest, recoveryOrigin, recoverySession, recoveryPurpose, clearRecovery } from "@/lib/admin/recovery";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  adminClient,
  eligibleStaff,
  requireAdmin,
  requireRecordAdministrator,
  requireStaffEnrollment,
  staffSession,
} from "@/lib/admin/server";
import {
  isRecordKind,
  validId,
  validNote,
  validStatus,
  isLifecycleOperation,
  lifecyclePermission,
  lifecycleConfirmations,
} from "@/lib/admin/workflow";
export type ActionState = { error?: string; success?: string };
export async function login(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const email = String(form.get("email") || "").trim(),
    password = String(form.get("password") || "");
  if (!email || !password || email.length > 254 || password.length > 256)
    return { error: "Enter your email and password." };
  const client = await adminClient();
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error)
    return { error: "Unable to sign in. Check your details and try again." };
  const session = await staffSession();
  if (!eligibleStaff(session.identity)) {
    await client.auth.signOut({ scope: "local" });
    return { error: "This account does not have staff access." };
  }
  redirect("/admin");
}
export async function signOut() {
  const client = await adminClient();
  await client.auth.signOut({ scope: "local" });
  await clearRecovery();
  redirect("/admin/login");
}
export async function enrollMfa(): Promise<{
  error?: string;
  factorId?: string;
  qr?: string;
  secret?: string;
}> {
  const { client } = await requireStaffEnrollment();
  const factors = await client.auth.mfa.listFactors();
  if (factors.error)
    return { error: "Unable to load MFA settings. Try again." };
  if (factors.data.totp.some((f) => f.status === "verified"))
    return { error: "Use your existing authenticator to verify your account." };
  for (const factor of factors.data.all.filter(
    (f) => f.factor_type === "totp" && f.status === "unverified",
  )) {
    const removed = await client.auth.mfa.unenroll({ factorId: factor.id });
    if (removed.error)
      return { error: "Unable to restart enrollment. Try again." };
  }
  const result = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "JB Squeaky staff authenticator",
  });
  if (result.error)
    return {
      error: "Authenticator setup is unavailable. Contact your administrator.",
    };
  return {
    factorId: result.data.id,
    qr: result.data.totp.qr_code,
    secret: result.data.totp.secret,
  };
}
export async function verifyMfa(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client } = await requireStaffEnrollment();
  const factorId = String(form.get("factorId") || ""),
    code = String(form.get("code") || "").trim();
  if (!validId(factorId) || !/^\d{6}$/.test(code))
    return { error: "Enter the six-digit authenticator code." };
  const result = await client.auth.mfa.challengeAndVerify({ factorId, code });
  if (result.error)
    return {
      error:
        "That code could not be verified. Use a current code and try again.",
    };
  redirect("/admin");
}
export async function verifyRecoveryMfa(_state: ActionState, form: FormData): Promise<ActionState> {
  const { client } = await requireStaffEnrollment(true);
  const session = await recoverySession(client);
  if (!session.recovery || !(await recoveryPurpose(session.userId, session.sessionId)))
    return { error: "Request a new recovery link to continue." };
  const factorId = String(form.get("factorId") || ""), code = String(form.get("code") || "").trim();
  const factors = await client.auth.mfa.listFactors();
  if (!validId(factorId) || !/^\d{6}$/.test(code) || factors.error ||
      !factors.data.totp.some(f => f.id === factorId && f.status === "verified"))
    return { error: "Use your existing verified authenticator." };
  const result = await client.auth.mfa.challengeAndVerify({ factorId, code });
  if (result.error) return { error: "That code could not be verified. Try a current code." };
  redirect("/admin/setup");
}
export async function setPassword(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const { client, user } = await requireStaffEnrollment(true);
  const session = await recoverySession(client);
  const purpose = await recoveryPurpose(session.userId, session.sessionId);
  const password = String(form.get("password") || "");
  if (
    password.length < 12 ||
    password.length > 128 ||
    password !== form.get("confirm")
  )
    return { error: "Use matching passwords between 12 and 128 characters." };
  const result = await client.auth.updateUser({ password });
  if (result.error)
    return { error: "Unable to save your password. Please try again." };
  if (session.recovery && purpose === "invite" && user?.email) {
    // Legacy Auth uses otp for invitations too. Establish a password-authenticated
    // session after invite setup, preserving the existing direct MFA transition.
    const signedIn = await client.auth.signInWithPassword({ email: user.email, password });
    if (signedIn.error) return { error: "Password saved. Sign in with your new password to continue." };
    await clearRecovery();
    redirect("/admin/mfa");
  }
  if (session.recovery) {
    await client.auth.signOut({ scope: "local" });
    await clearRecovery();
    redirect("/admin/login?reason=password-saved");
  }
  redirect("/admin/mfa");
}
export async function requestRecovery(_state: ActionState, form: FormData): Promise<ActionState> {
  const response = { success: "If this account is eligible, a password reset email will arrive shortly. Check your inbox and spam folder." };
  const email = String(form.get("email") || "").trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Enter a valid email address." };
  try {
    const requestHeaders = await headers();
    const source = requestHeaders.get("x-vercel-forwarded-for") || requestHeaders.get("x-forwarded-for") || "unknown";
    if (allowRecoveryRequest(email, source)) {
      const client = await adminClient();
      await client.auth.resetPasswordForEmail(email, { redirectTo: `${recoveryOrigin()}/admin/auth/recovery` });
    }
  } catch { /* Same response for unavailable, rate-limited and unknown accounts. */ }
  return response;
}
export async function manageRecord(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const kind = form.get("kind"),
    id = form.get("id"),
    operation = form.get("operation");
  if (!isRecordKind(kind) || !validId(id)) return { error: "Invalid record." };
  const { client } = await requireAdmin(`${kind}.manage`);
  let result;
  if (operation === "status") {
    const status = form.get("status");
    if (!validStatus(kind, status)) return { error: "Choose a valid status." };
    result = await client.rpc("admin_set_status", {
      record_kind: kind,
      record_id: id,
      next_status: status,
    });
  } else if (operation === "note") {
    const body = form.get("note");
    if (!validNote(body))
      return { error: "Enter a note between 1 and 4,000 characters." };
    result = await client.rpc("admin_add_note", {
      record_kind: kind,
      record_id: id,
      note_body: body.trim(),
    });
  } else return { error: "Invalid action." };
  if (result.error)
    return {
      error:
        "The change was not confirmed. Refresh the record before retrying.",
    };
  revalidatePath(`/admin/${kind}/${id}`);
  revalidatePath(`/admin/${kind}`);
  revalidatePath("/admin");
  return { success: operation === "status" ? "Status saved." : "Note saved." };
}

export async function changeRecordLifecycle(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const kind = form.get("kind"), id = form.get("id"), operation = form.get("operation");
  if (!isRecordKind(kind) || !validId(id) || !isLifecycleOperation(operation))
    return { error: "Invalid action." };
  const { client } = await requireRecordAdministrator(`${kind}.${lifecyclePermission(operation)}`);
  if (form.get("confirmation") !== lifecycleConfirmations[operation])
    return { error: "Confirm this action before continuing." };
  const result = await client.rpc("admin_record_lifecycle", {
    record_kind: kind, record_id: id, operation,
    confirmation: lifecycleConfirmations[operation],
  });
  if (result.error) return { error: "The change was not confirmed. A legal hold prevents permanent deletion. Refresh the record before retrying." };
  revalidatePath("/admin", "layout");
  if (operation === "purge" || operation === "delete") redirect(`/admin/${kind}/trash`);
  if (operation === "restore") redirect(`/admin/${kind}/${id}`);
  return { success: operation === "hold" ? "Legal hold placed." : "Legal hold released." };
}
