import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminConfiguration, adminCookieOptions } from "./config";
import { recoverySession, hasRecovery } from "./recovery";

export async function adminClient() {
  // Reach the request-time API before checking environment configuration.
  // Otherwise missing credentials can throw while Next.js prerenders a route.
  const store = await cookies();
  const config = adminConfiguration();
  if (!config) throw new Error("Admin authentication is not configured.");
  return createServerClient(config.url, config.key, {
    cookieOptions: adminCookieOptions,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server Components cannot write cookies. Proxy refreshes them. */
        }
      },
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
export type StaffIdentity = {
  role: "administrator" | "manager" | "employee";
  status: "active" | "suspended";
};
export async function staffSession() {
  const client = await adminClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return { client, user: null, identity: null };
  const result = await client.rpc("admin_identity");
  const identity = !result.error ? (result.data as StaffIdentity | null) : null;
  return { client, user, identity };
}
export function eligibleStaff(identity: StaffIdentity | null) {
  return (
    identity?.status === "active" &&
    ["administrator", "manager"].includes(identity.role)
  );
}
export async function requireStaffEnrollment(allowPasswordSetup = false) {
  const session = await staffSession();
  if (!session.user) redirect("/admin/login");
  if (!eligibleStaff(session.identity)) redirect("/admin/login?reason=access");
  const verified = await recoverySession(session.client);
  if (verified.userId !== session.user.id) redirect("/admin/login?reason=access");
  if (verified.recovery) {
    if (!allowPasswordSetup) redirect("/admin/setup");
    if (!(await hasRecovery(verified.userId, verified.sessionId)))
      redirect("/admin/forgot-password?reason=recovery");
  }
  return session;
}
export async function requireAdmin(permission = "dashboard.read") {
  const session = await requireStaffEnrollment();
  const { data, error } =
    await session.client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || data?.currentLevel !== "aal2") redirect("/admin/mfa");
  const authorization = await session.client.rpc("has_staff_permission", {
    required_permission: permission,
  });
  if (authorization.error || authorization.data !== true)
    redirect("/admin/login?reason=access");
  return session;
}

export async function requireRecordAdministrator(permission: string) {
  const session = await requireAdmin(permission);
  if (session.identity?.role !== "administrator")
    redirect("/admin/login?reason=access");
  return session;
}
