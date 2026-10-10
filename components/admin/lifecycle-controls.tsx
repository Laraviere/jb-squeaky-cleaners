"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { changeRecordLifecycle } from "@/app/admin/actions";
import { lifecycleConfirmations, type LifecycleOperation, type RecordKind } from "@/lib/admin/workflow";

const labels: Record<LifecycleOperation, string> = {
  delete: "Move to Trash", restore: "Restore record", purge: "Permanently delete",
  hold: "Place legal hold", release_hold: "Release legal hold",
};
export function LifecycleControls({ kind, id, trash, legalHold }: {
  kind: RecordKind; id: string; trash: boolean; legalHold: boolean;
}) {
  const [operation, setOperation] = useState<LifecycleOperation>("delete");
  const [state, action, pending] = useActionState(changeRecordLifecycle, {});
  const dialog = useRef<HTMLDialogElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error) error.current?.focus();
    else if (state.success) dialog.current?.close();
  }, [state]);
  const open = (next: LifecycleOperation) => {
    setOperation(next);
    requestAnimationFrame(() => dialog.current?.showModal());
  };
  return (
    <section className="admin-panel admin-record-controls">
      <h2>{trash ? "Trash actions" : "Record protection"}</h2>
      <p>{legalHold ? "Legal hold active. Permanent deletion is blocked." : "No legal hold is recorded. Check retention obligations before permanent deletion."}</p>
      <div className="admin-record-buttons">
        <button className="admin-button" type="button" onClick={() => open(trash ? "restore" : "delete")}>{trash ? "Restore record" : "Delete record"}</button>
        <button className="admin-button admin-button-secondary" type="button" onClick={() => open(legalHold ? "release_hold" : "hold")}>{legalHold ? "Release legal hold" : "Place legal hold"}</button>
        {trash && <button className="admin-button admin-button-danger" type="button" disabled={legalHold} onClick={() => open("purge")}>Permanently delete</button>}
      </div>
      {state.success && <p role="status">{state.success}</p>}
      <dialog ref={dialog} className="admin-confirm-dialog" aria-labelledby="record-confirm-title" onCancel={(event) => { if (pending) event.preventDefault(); }}>
        <h2 id="record-confirm-title">{labels[operation]}</h2>
        <p>
          {operation === "purge" ? "This cannot be undone. The original submission, internal notes, workflow, and linked history will be deleted. A deletion receipt without customer or applicant content will be retained for at least 24 months."
            : operation === "delete" ? "Move this record to Trash? Its original information, status, notes, and history will be preserved."
            : operation === "restore" ? "Restore this record to the active list with its previous status, notes, and history?"
            : operation === "hold" ? "A legal hold blocks permanent deletion until an administrator releases it."
            : "Release this legal hold only when the preservation obligation has ended. Releasing it does not delete the record."}
        </p>
        <form action={action} className="admin-form" key={operation}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="operation" value={operation} />
          {operation === "purge" ? <label>Type PERMANENTLY DELETE to confirm<input name="confirmation" required pattern="PERMANENTLY DELETE" autoComplete="off" /></label>
            : <input type="hidden" name="confirmation" value={lifecycleConfirmations[operation]} />}
          {state.error && <p ref={error} tabIndex={-1} role="alert" className="admin-error">{state.error}</p>}
          <div className="admin-record-buttons">
            <button type="button" className="admin-button admin-button-secondary" disabled={pending} onClick={() => dialog.current?.close()}>Cancel</button>
            <button className={`admin-button ${operation === "purge" ? "admin-button-danger" : ""}`} disabled={pending}>{pending ? "Saving…" : labels[operation]}</button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
