import "server-only";
import {
  createHmac,
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { applicationPayload, type ApplicationDraft } from "./employment";

function configuration() {
  if (process.env.EMPLOYMENT_APPLICATIONS_ENABLED !== "true") return null;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.EMPLOYMENT_APPLICATION_SECRET;
  if (!url || !key || !secret || secret.length < 32) return null;
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
    return { url: parsed.origin, key, secret };
  } catch {
    return null;
  }
}

async function rpc(name: string, body: unknown) {
  const config = configuration();
  if (!config) throw new Error("Application storage unavailable.");
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: config.key,
  };
  if (!config.key.startsWith("sb_secret_"))
    requestHeaders.Authorization = `Bearer ${config.key}`;
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Application storage request failed.");
  return response.json() as Promise<unknown>;
}

export async function applicationAvailable() {
  if (!configuration()) return false;
  try {
    return (await rpc("employment_submission_ready", {})) === 1;
  } catch {
    return false;
  }
}

export function createApplicationToken() {
  const config = configuration();
  if (!config) return "";
  const body = Buffer.from(
    JSON.stringify({ id: randomUUID(), issued: Date.now() }),
  ).toString("base64url");
  return `${body}.${createHmac("sha256", config.secret).update(body).digest("base64url")}`;
}

export function verifyApplicationToken(token: string): string | null {
  const config = configuration();
  if (!config || token.length > 500) return null;
  try {
    const [body, signature, extra] = token.split(".");
    if (!body || !signature || extra) return null;
    const expected = createHmac("sha256", config.secret).update(body).digest();
    const received = Buffer.from(signature, "base64url");
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      return null;
    const value: unknown = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    );
    if (!value || typeof value !== "object") return null;
    const { id, issued } = value as { id: unknown; issued: unknown };
    if (
      typeof id !== "string" ||
      !/^[a-f0-9-]{36}$/.test(id) ||
      typeof issued !== "number"
    )
      return null;
    const age = Date.now() - issued;
    return age >= 2000 && age <= 24 * 60 * 60 * 1000 ? id : null;
  } catch {
    return null;
  }
}

export async function saveApplication(
  draft: ApplicationDraft,
  submissionId: string,
) {
  const config = configuration();
  if (!config) throw new Error("Application storage unavailable.");
  const requestHeaders = await headers();
  // Vercel supplies this header. Outside Vercel use a shared conservative bucket,
  // rather than trusting arbitrary forwarded headers from public clients.
  const candidate =
    process.env.VERCEL === "1"
      ? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
      : undefined;
  const source =
    candidate && isIP(candidate) ? candidate : "shared-non-vercel-source";
  const bucket = createHmac("sha256", config.secret)
    .update(`employment-rate:${source}`)
    .digest("hex");
  const payload = applicationPayload(draft);
  const digest = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  const id = await rpc("submit_employment_application", {
    p_submission_id: submissionId,
    p_payload: payload,
    p_digest: digest,
    p_bucket: bucket,
  });
  if (
    typeof id !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
  )
    throw new Error("Application save was not confirmed.");
  return id;
}
