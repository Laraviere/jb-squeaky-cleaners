export const quoteStatuses = [
  "new",
  "contacted",
  "quote_in_progress",
  "quote_sent",
  "won",
  "lost",
] as const;
export const applicationStatuses = [
  "new",
  "reviewing",
  "interview",
  "offered",
  "hired",
  "rejected",
  "archived",
] as const;
export type RecordKind = "quotes" | "applications";
export function statuses(kind: RecordKind) {
  return kind === "quotes" ? quoteStatuses : applicationStatuses;
}
export function statusLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
export function isRecordKind(value: unknown): value is RecordKind {
  return value === "quotes" || value === "applications";
}
export function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export function validStatus(kind: RecordKind, value: unknown): value is string {
  return (
    typeof value === "string" &&
    (statuses(kind) as readonly string[]).includes(value)
  );
}
export function validNote(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 4000
  );
}
