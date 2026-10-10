"use client";
import { useActionState } from "react";
import { manageRecord } from "@/app/admin/actions";
import { type RecordKind, statuses, statusLabel } from "@/lib/admin/workflow";
export function WorkflowControls({
  kind,
  id,
  status,
}: {
  kind: RecordKind;
  id: string;
  status: string;
}) {
  const [statusState, statusAction, statusPending] = useActionState(
      manageRecord,
      {},
    ),
    [noteState, noteAction, notePending] = useActionState(manageRecord, {});
  return (
    <div className="admin-workflow">
      <section className="admin-panel">
        <h2>Workflow status</h2>
        <form className="admin-form" action={statusAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="operation" value="status" />
          <div className="admin-field">
            <label htmlFor="workflow-status">Status</label>
            <select
              id="workflow-status"
              name="status"
              defaultValue={status}
              key={status}
            >
              {statuses(kind).map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <button className="admin-button" disabled={statusPending}>
            {statusPending ? "Saving…" : "Save status"}
          </button>
          {statusState.error && (
            <p role="alert" className="admin-error">
              {statusState.error}
            </p>
          )}
          {statusState.success && <p role="status">{statusState.success}</p>}
        </form>
      </section>
      <section className="admin-panel">
        <h2>Internal note</h2>
        <p>Staff-only. Keep notes relevant and respectful.</p>
        <form className="admin-form" action={noteAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="operation" value="note" />
          <label>
            Note
            <textarea name="note" required maxLength={4000} rows={4} />
          </label>
          <button className="admin-button" disabled={notePending}>
            {notePending ? "Saving…" : "Add note"}
          </button>
          {noteState.error && (
            <p role="alert" className="admin-error">
              {noteState.error}
            </p>
          )}
          {noteState.success && <p role="status">{noteState.success}</p>}
        </form>
      </section>
    </div>
  );
}
