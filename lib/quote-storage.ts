import "server-only";
import type { QuoteRequest } from "./quote";

export function getQuoteConfiguration() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))) return null;
    return { url: parsed.origin, key };
  } catch { return null; }
}

export async function saveQuote(values: QuoteRequest): Promise<void> {
  const config = getQuoteConfiguration();
  if (!config) throw new Error("Quote storage is not configured.");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: config.key,
    Prefer: "return=representation",
  };
  // New sb_secret keys are not JWTs. Legacy service_role keys need a bearer token.
  if (!config.key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${config.key}`;
  const response = await fetch(`${config.url}/rest/v1/quote_requests?select=id`, {
    method: "POST", headers, body: JSON.stringify(values), cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (response.status !== 201) throw new Error(`Quote insert failed (${response.status}).`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0]?.id !== "string" || !rows[0].id) throw new Error("Quote save was not confirmed.");
}
