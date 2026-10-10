import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminCookieOptions } from "./config";

export const recoveryCookie = "jb-admin-recovery";
export const recoveryLifetime = 15 * 60;
function signingKey() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Staff recovery is not configured.");
  // Domain separation: the privileged key is used only server-side for HMAC.
  return createHmac("sha256", key).update("jb-admin-recovery-v1").digest();
}
export function recoveryOrigin() {
  const url = new URL(process.env.ADMIN_SITE_URL ||
    (process.env.NODE_ENV === "production" ? "https://www.jbsqueakycleaners.com" : "http://localhost:3000"));
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))
    throw new Error("Invalid staff recovery origin.");
  return url.origin;
}
export async function recoverySession(client: SupabaseClient) {
  const { data, error } = await client.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string" || typeof claims.session_id !== "string")
    throw new Error("Unable to verify staff session.");
  const methods = claims.amr;
  if (!Array.isArray(methods) || !methods.length)
    throw new Error("Missing staff authentication method.");
  return {
    userId: claims.sub,
    sessionId: claims.session_id,
    // Older Supabase Auth versions mark email recovery as otp; gate both.
    recovery: methods.some((m) => (typeof m === "string" ? m : m.method) === "recovery" || (typeof m === "string" ? m : m.method) === "otp"),
  };
}
export function signRecovery(userId: string, sessionId: string, now = Date.now(), purpose: "recovery" | "invite" = "recovery") {
  const body = Buffer.from(JSON.stringify({ userId, sessionId, purpose, expires: Math.floor(now / 1000) + recoveryLifetime })).toString("base64url");
  return `${body}.${createHmac("sha256", signingKey()).update(body).digest("base64url")}`;
}
export function validRecovery(value: string | undefined, userId: string, sessionId: string, now = Date.now()) {
  try {
    if (!value || value.length > 1500) return false;
    const [body, signature, extra] = value.split(".");
    if (extra || !signature) return false;
    const expected = createHmac("sha256", signingKey()).update(body).digest();
    const actual = Buffer.from(signature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
    const state = JSON.parse(Buffer.from(body, "base64url").toString());
    const seconds = Math.floor(now / 1000);
    return state.userId === userId && state.sessionId === sessionId && ["invite", "recovery"].includes(state.purpose) &&
      Number.isInteger(state.expires) && state.expires > seconds && state.expires <= seconds + recoveryLifetime;
  } catch { return false; }
}
export async function beginRecovery(userId: string, sessionId: string, purpose: "recovery" | "invite" = "recovery") {
  (await cookies()).set(recoveryCookie, signRecovery(userId, sessionId, Date.now(), purpose), { ...adminCookieOptions, name: recoveryCookie, maxAge: recoveryLifetime });
}
export async function hasRecovery(userId: string, sessionId: string) {
  return validRecovery((await cookies()).get(recoveryCookie)?.value, userId, sessionId);
}
export async function recoveryPurpose(userId: string, sessionId: string): Promise<"invite" | "recovery" | null> {
  const value = (await cookies()).get(recoveryCookie)?.value;
  if (!validRecovery(value, userId, sessionId)) return null;
  return JSON.parse(Buffer.from(value!.split(".")[0], "base64url").toString()).purpose;
}
export async function clearRecovery() {
  (await cookies()).set(recoveryCookie, "", { ...adminCookieOptions, name: recoveryCookie, maxAge: 0 });
}
// Additional bounded per-instance throttling. Supabase's persistent Auth email
// limits remain authoritative across Vercel instances (configure before rollout).
const attempts = new Map<string, { count: number; until: number }>();
export function allowRecoveryRequest(email: string, source: string, now = Date.now()) {
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const keys = ["email:" + email.toLowerCase(), "source:" + source].map((v) => createHmac("sha256", signingKey()).update(v).digest("hex"));
  if (attempts.size > 10000) return false;
  if (keys.some((key, i) => (attempts.get(key)?.count || 0) >= (i === 0 ? 3 : 10))) return false;
  for (const key of keys) {
    const value = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    value.count++;
    attempts.set(key, value);
  }
  return true;
}
