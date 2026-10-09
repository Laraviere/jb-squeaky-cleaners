import {
  applicationSteps,
  employerFields,
  referenceFields,
  emptyApplication,
  type ApplicationDraft,
  type ApplicationField,
} from "./employment";

export const employmentDraftKey = "jb-squeaky:employment-draft:v1";
export const draftLifetime = 7 * 24 * 60 * 60 * 1000;
export const draftDebounce = 400;
export type SavedEmploymentDraft = {
  version: 1;
  createdAt: number;
  savedAt: number;
  step: number;
  submissionUnconfirmed: boolean;
  draft: ApplicationDraft;
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

// Only known applicant fields are allowed; never spread arbitrary stored metadata.
export function applicantDraft(input: unknown): ApplicationDraft | null {
  if (
    !object(input) ||
    !object(input.answers) ||
    !Array.isArray(input.employers) ||
    input.employers.length > 3 ||
    !Array.isArray(input.references) ||
    input.references.length !== 2 ||
    typeof input.accepted !== "boolean" ||
    typeof input.acknowledgment !== "string" ||
    input.acknowledgment.length > 150
  )
    return null;
  function fields(
    source: Record<string, unknown>,
    definitions: readonly ApplicationField[],
  ) {
    const result: Record<string, string | string[]> = {};
    for (const field of definitions) {
      const value = source[field.id];
      if (value === undefined) continue;
      if (field.type === "checks") {
        if (
          !Array.isArray(value) ||
          value.some(
            (v) => typeof v !== "string" || !field.options?.includes(v),
          )
        )
          return null;
        result[field.id] = [...new Set(value)] as string[];
      } else {
        if (
          typeof value !== "string" ||
          value.length > (field.maxLength ?? 150)
        )
          return null;
        result[field.id] = value;
      }
    }
    return result;
  }
  const answers = fields(
    input.answers,
    applicationSteps.flatMap<ApplicationField>((s) => s.fields),
  );
  if (!answers) return null;
  const result = emptyApplication();
  result.answers = answers;
  for (const kind of ["employers", "references"] as const) {
    const rows = [];
    for (const row of input[kind] as unknown[]) {
      if (!object(row)) return null;
      const clean = fields(
        row,
        kind === "employers" ? employerFields : referenceFields,
      );
      if (!clean) return null;
      rows.push(clean as Record<string, string>);
    }
    result[kind] = rows;
  }
  result.accepted = input.accepted;
  result.acknowledgment = input.acknowledgment;
  return result;
}

export function decodeEmploymentDraft(
  raw: string,
  now = Date.now(),
): SavedEmploymentDraft | null {
  try {
    if (raw.length > 60000) return null;
    const value: unknown = JSON.parse(raw);
    if (
      !object(value) ||
      value.version !== 1 ||
      typeof value.createdAt !== "number" ||
      !Number.isFinite(value.createdAt) ||
      value.createdAt <= 0 ||
      value.createdAt > now ||
      now - value.createdAt >= draftLifetime ||
      typeof value.savedAt !== "number" ||
      !Number.isFinite(value.savedAt) ||
      value.savedAt < value.createdAt ||
      value.savedAt > now ||
      !Number.isInteger(value.step) ||
      Number(value.step) < 0 ||
      Number(value.step) >= applicationSteps.length ||
      typeof value.submissionUnconfirmed !== "boolean"
    )
      return null;
    const draft = applicantDraft(value.draft);
    if (!draft) return null;
    return {
      version: 1,
      createdAt: value.createdAt,
      savedAt: value.savedAt,
      step: Number(value.step),
      submissionUnconfirmed: value.submissionUnconfirmed,
      draft,
    };
  } catch {
    return null;
  }
}

export function hasApplicationProgress(draft: ApplicationDraft, step: number) {
  return (
    step > 0 ||
    draft.employers.length > 0 ||
    draft.accepted ||
    !!draft.acknowledgment ||
    Object.values(draft.answers).some((v) => v.length > 0) ||
    draft.references.some((r) => Object.values(r).some(Boolean))
  );
}

export function writeEmploymentDraft(
  storage: Pick<Storage, "setItem">,
  record: SavedEmploymentDraft,
): boolean {
  try {
    const draft = applicantDraft(record.draft);
    if (!draft) return false;
    // A fresh envelope explicitly excludes tokens, credentials, and server state.
    storage.setItem(
      employmentDraftKey,
      JSON.stringify({
        version: 1,
        createdAt: record.createdAt,
        savedAt: record.savedAt,
        step: record.step,
        submissionUnconfirmed: record.submissionUnconfirmed,
        draft,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function removeEmploymentDraft(
  storage: Pick<Storage, "removeItem">,
): boolean {
  try {
    storage.removeItem(employmentDraftKey);
    return true;
  } catch {
    return false;
  }
}
