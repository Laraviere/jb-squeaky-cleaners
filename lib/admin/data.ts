import "server-only";
import { notFound } from "next/navigation";
import { requireAdmin, requireRecordAdministrator } from "./server";
import { type RecordKind, validId, validStatus } from "./workflow";
export type ListRow = {
  id: string;
  name: string;
  email: string;
  submitted_at: string;
  service_type: string;
  workflow_status: string;
  deleted_at?: string;
  deleted_by?: string;
  legal_hold?: boolean;
};
export type HistoryRow = {
  id: string;
  created_at: string;
  actor_id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  quote_id?: string;
  application_id?: string;
};
export type NoteRow = {
  id: string;
  body: string;
  actor_id: string;
  created_at: string;
};
export type RecordData = {
  id: string;
  workflow_status: string;
  created_at?: string;
  submitted_at?: string;
  [key: string]: unknown;
};
export type ListParams = {
  q?: string | string[];
  status?: string | string[];
  sort?: string | string[];
  page?: string | string[];
};
export async function listRecords(kind: RecordKind, params: ListParams, trash = false) {
  const session = trash ? await requireRecordAdministrator(`${kind}.trash`) : await requireAdmin(`${kind}.read`);
  const { client } = session;
  const q = (typeof params.q === "string" ? params.q : "").slice(0, 200),
    status = validStatus(kind, params.status) ? params.status : "",
    sort = params.sort === "oldest" ? "oldest" : "newest";
  const page = Math.min(
    100000,
    Math.max(
      1,
      parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1,
    ),
  );
  const { data, error } = await client.rpc(trash ? "admin_list_trash" : "admin_list_records", {
    record_kind: kind,
    search_text: q,
    status_filter: status,
    oldest_first: sort === "oldest",
    page_number: page,
  });
  if (error) throw new Error("Unable to load records.");
  const receipts = trash ? await client.from("record_deletion_receipts")
    .select("record_id,actor_id,deleted_at,retain_until,legal_hold")
    .eq("record_kind", kind).order("deleted_at", { ascending: false }).limit(20) : null;
  if (receipts?.error) throw new Error("Unable to load deletion history.");
  return {
    ...(data as { rows: ListRow[]; total: number }),
    q,
    status,
    sort,
    page,
    administrator: session.identity?.role === "administrator",
    trash,
    receipts: (receipts?.data ?? []) as { record_id: string; actor_id: string; deleted_at: string; retain_until: string; legal_hold: boolean }[],
  };
}
export async function recordDetail(kind: RecordKind, id: string, trash = false) {
  if (!validId(id)) notFound();
  const session = trash ? await requireRecordAdministrator(`${kind}.trash`) : await requireAdmin(`${kind}.read`);
  const { client } = session;
  const record = await client
    .from(trash ? (kind === "quotes" ? "admin_trash_quotes" : "admin_trash_applications") : (kind === "quotes" ? "admin_quotes" : "admin_applications"))
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (record.error) throw new Error("Unable to load this record.");
  if (!record.data) notFound();
  const lifecycle = session.identity?.role === "administrator" ? await client
    .from("record_lifecycle").select("legal_hold,deleted_at,deleted_by")
    .eq("record_kind", kind).eq("record_id", id).maybeSingle() : null;
  if (lifecycle?.error) throw new Error("Unable to load record protection.");
  const column = kind === "quotes" ? "quote_id" : "application_id";
  const [notes, history] = await Promise.all([
    client
      .from("staff_notes")
      .select("*")
      .eq(column, id)
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("staff_audit_events")
      .select("*")
      .eq(column, id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (notes.error || history.error)
    throw new Error("Unable to load staff history.");
  return {
    record: record.data as RecordData,
    notes: notes.data as NoteRow[],
    history: history.data as HistoryRow[],
    administrator: session.identity?.role === "administrator",
    lifecycle: lifecycle?.data as { legal_hold: boolean; deleted_at: string | null; deleted_by: string | null } | null,
  };
}
export async function dashboardData() {
  const { client } = await requireAdmin();
  const { data, error } = await client.rpc("admin_dashboard");
  if (error) throw new Error("Unable to load dashboard.");
  const [quotes, applications] = await Promise.all([
    client
      .from("admin_quotes")
      .select("id,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    client
      .from("admin_applications")
      .select("id,submitted_at")
      .order("submitted_at", { ascending: false })
      .limit(5),
  ]);
  if (quotes.error || applications.error)
    throw new Error("Unable to load recent submissions.");
  return {
    ...(data as {
      quotes: number;
      newQuotes: number;
      applications: number;
      newApplications: number;
      activity: HistoryRow[];
    }),
    recent: [
      ...quotes.data.map((q) => ({
        id: q.id,
        date: q.created_at,
        kind: "quotes" as const,
      })),
      ...applications.data.map((a) => ({
        id: a.id,
        date: a.submitted_at,
        kind: "applications" as const,
      })),
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8),
  };
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(value));
}
