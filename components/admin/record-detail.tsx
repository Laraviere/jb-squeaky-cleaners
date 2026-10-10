import Link from "next/link";
import { recordDetail, formatDate } from "@/lib/admin/data";
import { type RecordKind, statusLabel } from "@/lib/admin/workflow";
import {
  applicationSteps,
  employerFields,
  referenceFields,
  type ApplicationField,
} from "@/lib/employment";
import { WorkflowControls } from "./workflow-controls";
function displayValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "")
    return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value.length
      ? value
          .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)))
          .join(", ")
      : "None provided";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
function Fields({
  data,
  labels,
}: {
  data: Record<string, unknown>;
  labels: Record<string, string>;
}) {
  return (
    <dl className="admin-details">
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <dt>{labels[key] || statusLabel(key)}</dt>
          <dd>{displayValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
export async function RecordDetail({
  kind,
  id,
}: {
  kind: RecordKind;
  id: string;
}) {
  const { record, notes, history } = await recordDetail(kind, id);
  const submitted = String(record.created_at || record.submitted_at);
  const labels = Object.fromEntries(
    [
      ...applicationSteps.flatMap((s) => s.fields as ApplicationField[]),
      ...employerFields,
      ...referenceFields,
    ].map((f) => [f.id, f.label]),
  );
  return (
    <>
      <Link className="admin-back-link" href={`/admin/${kind}`}>
        ← Back to {kind === "quotes" ? "quote requests" : "applications"}
      </Link>
      <header className="admin-page-header">
        <p className="admin-eyebrow">Original submission · Read only</p>
        <h1>
          {kind === "quotes"
            ? String(record.name)
            : String((record.applicant as Record<string, unknown>).full_name)}
        </h1>
        <p>Submitted {formatDate(submitted)} (Eastern)</p>
        <span className="admin-status">
          {statusLabel(record.workflow_status)}
        </span>
      </header>
      <div className="admin-detail-grid">
        <div className="admin-submission">
          {kind === "quotes" ? (
            <section className="admin-panel">
              <h2>Quote request</h2>
              <Fields
                data={Object.fromEntries(
                  [
                    "name",
                    "phone",
                    "email",
                    "service_type",
                    "location",
                    "frequency",
                    "property_size",
                    "preferred_timing",
                    "details",
                  ].map((key) => [key, record[key]]),
                )}
                labels={{
                  name: "Name",
                  phone: "Phone",
                  email: "Email",
                  service_type: "Service type",
                  location: "Location",
                  frequency: "Cleaning frequency",
                  property_size: "Approximate property size",
                  preferred_timing: "Preferred timing",
                  details: "Cleaning details",
                }}
              />
            </section>
          ) : (
            applicationSteps.map((step) => {
              const value =
                record[
                  step.group === "references"
                    ? "applicant_references"
                    : step.group
                ];
              return (
                <section className="admin-panel" key={step.group}>
                  <h2>{step.title}</h2>
                  {Array.isArray(value) ? (
                    value.length ? (
                      value.map((item, i) => (
                        <div className="admin-array-item" key={i}>
                          <h3>
                            {step.group === "employment_history"
                              ? "Employer"
                              : "Reference"}{" "}
                            {i + 1}
                          </h3>
                          <Fields
                            data={item as Record<string, unknown>}
                            labels={labels}
                          />
                        </div>
                      ))
                    ) : (
                      <p>No employment history provided.</p>
                    )
                  ) : (
                    <Fields
                      data={(value || {}) as Record<string, unknown>}
                      labels={{
                        ...labels,
                        applicant_name: "Applicant acknowledgment",
                        accepted: "Certification accepted",
                        version: "Certification version",
                        text: "Certification statement",
                      }}
                    />
                  )}
                </section>
              );
            })
          )}
        </div>
        <div>
          <WorkflowControls
            kind={kind}
            id={id}
            status={record.workflow_status}
          />
          <section className="admin-panel">
            <h2>Internal notes</h2>
            {notes.length ? (
              <ul className="admin-note-list">
                {notes.map((n) => (
                  <li key={n.id}>
                    <p>{n.body}</p>
                    <time dateTime={n.created_at}>
                      {formatDate(n.created_at)}
                    </time>
                    <small>Staff ID: {n.actor_id}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No internal notes yet.</p>
            )}
            {notes.length === 100 && <p>Showing the latest 100 notes.</p>}
          </section>
          <section className="admin-panel">
            <h2>Status & action history</h2>
            {history.length ? (
              <ol className="admin-activity">
                {history.map((h) => (
                  <li key={h.id}>
                    <strong>
                      {h.action === "note_added"
                        ? "Internal note added"
                        : `${statusLabel(h.old_status || "new")} → ${statusLabel(h.new_status || "new")}`}
                    </strong>
                    <time dateTime={h.created_at}>
                      {formatDate(h.created_at)}
                    </time>
                    <small>Staff ID: {h.actor_id}</small>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No staff changes. Initial status: New.</p>
            )}
            {history.length === 100 && <p>Showing the latest 100 events.</p>}
          </section>
        </div>
      </div>
    </>
  );
}
