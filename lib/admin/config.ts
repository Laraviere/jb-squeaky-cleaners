// This configuration uses only the publishable/anon key, never privileged credentials.
export function adminConfiguration() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(parsed.hostname)
      )
    )
      return null;
    if (key.startsWith("sb_secret_")) return null;
    // Reject a legacy service_role JWT accidentally placed in the anon-key variable.
    if (key.split(".").length === 3) {
      const payload = JSON.parse(
        Buffer.from(key.split(".")[1], "base64url").toString(),
      );
      if (payload.role !== "anon") return null;
    } else if (!key.startsWith("sb_publishable_")) return null;
    return { url: parsed.origin, key };
  } catch {
    return null;
  }
}
export const adminCookieOptions = {
  // Supabase's default name uses only the API hostname (e.g. sb-127-auth-token).
  // Other local apps can share that name; duplicate paths lose their identity
  // when Next.js parses cookies. Isolate this portal's session explicitly.
  name: "sb-jb-squeaky-admin-auth",
  path: "/admin",
  httpOnly: true,
  sameSite: "lax" as const,
  secure:
    process.env.NODE_ENV === "production" &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(
      process.env.SUPABASE_URL || "",
    ),
};
