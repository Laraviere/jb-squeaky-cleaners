"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { submitApplication } from "@/app/careers/actions";
import { recoverableEmploymentSubmission } from "@/lib/employment-submission";
import {
  applicationSteps,
  certificationText,
  employerFields,
  referenceFields,
  emptyApplication,
  validateApplication,
  isOvernightAvailability,
  type ApplicationDraft,
  type ApplicationErrors,
  type ApplicationField,
  type ApplicationState,
} from "@/lib/employment";
import { useEmploymentDraft } from "./use-employment-draft";
import { business } from "@/lib/site";

const initialState: ApplicationState = { status: "idle", message: "" };
const safeSubmitApplication =
  recoverableEmploymentSubmission(submitApplication);

export function EmploymentApplication({
  available,
  token,
}: {
  available: boolean;
  token: string;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ApplicationDraft>(emptyApplication);
  const [errors, setErrors] = useState<ApplicationErrors>({});
  const [state, formAction, pending] = useActionState(
    safeSubmitApplication,
    initialState,
  );
  const deviceDraft = useEmploymentDraft(
    draft,
    step,
    available,
    state.status === "success",
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const responseMessage = useRef<HTMLDivElement>(null);
  const stepChanged = useRef(false);
  useEffect(() => {
    if (stepChanged.current) heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (state.message) responseMessage.current?.focus();
  }, [state]);

  useEffect(() => {
    if (deviceDraft.phase === "recovery") heading.current?.focus();
  }, [deviceDraft.phase]);

  if (!available)
    return (
      <div className="application-unavailable" role="status">
        <h3>Online applications are not available yet.</h3>
        <p>
          Please check back for the online application. For career questions,{" "}
          <a href={`mailto:${business.email}`}>email {business.email}</a> or{" "}
          <a href={business.phoneHref}>call {business.phone}</a>.
        </p>
        <p>
          Applications cannot be sent or saved through this page at this time.
        </p>
      </div>
    );
  const startFresh = () => {
    deviceDraft.startNew();
    setDraft(emptyApplication());
    setStep(0);
    setErrors({});
    stepChanged.current = true;
    requestAnimationFrame(() => heading.current?.focus());
  };
  if (
    available &&
    deviceDraft.phase === "loading" &&
    state.status !== "success"
  )
    return (
      <div className="application-unavailable" role="status">
        Checking for a saved application on this device…
      </div>
    );
  if (
    available &&
    deviceDraft.phase === "recovery" &&
    state.status !== "success"
  )
    return (
      <section
        className="application-recovery"
        role="dialog"
        aria-modal="false"
        aria-labelledby="application-recovery-title"
        aria-describedby="application-recovery-description"
      >
        <span className="eyebrow">Your saved progress</span>
        <h3 ref={heading} tabIndex={-1} id="application-recovery-title">
          Continue your application?
        </h3>
        <p id="application-recovery-description">
          An unfinished application is saved on this device. Continue where you
          left off, or discard it and start fresh.
        </p>
        <p className="application-helper">
          Drafts expire seven days after their first save. On shared devices,
          discard your draft when finished.
        </p>
        {deviceDraft.saved?.submissionUnconfirmed && (
          <p role="status">
            A previous submission has not been confirmed. You can review your
            saved answers, but please contact us to confirm receipt before
            submitting a new application.
          </p>
        )}
        <div className="application-controls">
          <button
            type="button"
            className="button"
            onClick={() => {
              const restored = deviceDraft.continueDraft();
              if (!restored) return;
              setDraft(restored.draft);
              setStep(restored.step);
              stepChanged.current = true;
              requestAnimationFrame(() => heading.current?.focus());
            }}
          >
            Continue Application
          </button>
          <button
            type="button"
            className="button button-outline"
            onClick={startFresh}
          >
            Start New Application
          </button>
        </div>
      </section>
    );
  if (state.status === "success")
    return (
      <div
        className="application-success"
        ref={responseMessage}
        tabIndex={-1}
        role="status"
      >
        <h3>Application received.</h3>
        {deviceDraft.status.startsWith("Your application was saved,") && (
          <p role="alert">{deviceDraft.status}</p>
        )}
        <p>{state.message}</p>
        <p>
          Application ID: <strong>{state.applicationId}</strong>
        </p>
      </div>
    );

  const allErrors = { ...state.errors, ...errors };
  const setAnswer = (id: string, value: string | string[]) =>
    setDraft((d) => ({ ...d, answers: { ...d.answers, [id]: value } }));
  const setRow = (
    kind: "employers" | "references",
    index: number,
    id: string,
    value: string,
  ) =>
    setDraft((d) => ({
      ...d,
      [kind]: d[kind].map((row, i) =>
        i === index ? { ...row, [id]: value } : row,
      ),
    }));
  const changeStep = (next: number) => {
    stepChanged.current = true;
    setStep(next);
    setErrors({});
  };
  const focusError = (nextErrors: ApplicationErrors) =>
    requestAnimationFrame(() => {
      const id = Object.keys(nextErrors)[0];
      const element = document.getElementById(`application-${id}`);
      element?.focus();
      if (!element) heading.current?.focus();
    });
  const next = () => {
    const result = validateApplication(draft, step);
    setErrors(result.errors);
    if (Object.keys(result.errors).length) focusError(result.errors);
    else changeStep(step + 1);
  };
  const field = (
    definition: ApplicationField,
    value: string | string[] | undefined,
    onChange: (value: string | string[]) => void,
    prefix = "",
  ) => {
    const key = prefix + definition.id;
    const id = `application-${key}`;
    const error = allErrors[key];
    const props = {
      id,
      required: definition.required,
      "aria-invalid": !!error,
      "aria-describedby": error ? `${id}-error` : undefined,
    };
    const label = (
      <>
        {definition.label}
        {definition.required ? " *" : " (optional)"}
      </>
    );
    if (definition.type === "checks")
      return (
        <fieldset
          key={key}
          className="application-checks field-full"
          id={id}
          tabIndex={-1}
          aria-describedby={props["aria-describedby"]}
        >
          <legend>{label}</legend>
          <div className="application-options">
            {definition.options?.map((option) => (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...(Array.isArray(value) ? value : []), option]
                        : (Array.isArray(value) ? value : []).filter(
                            (x) => x !== option,
                          ),
                    )
                  }
                />
                {option}
              </label>
            ))}
          </div>
          {error && (
            <span className="field-error" id={`${id}-error`}>
              {error}
            </span>
          )}
        </fieldset>
      );
    const text = typeof value === "string" ? value : "";
    return (
      <div
        key={key}
        className={`field${definition.type === "textarea" ? " field-full" : ""}`}
      >
        <label htmlFor={id}>{label}</label>
        {definition.type === "select" ? (
          <select
            {...props}
            value={text}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Choose…</option>
            {definition.options?.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        ) : definition.type === "textarea" ? (
          <textarea
            {...props}
            value={text}
            rows={4}
            maxLength={definition.maxLength ?? 150}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            {...props}
            type={definition.type ?? "text"}
            value={text}
            autoComplete={definition.autoComplete}
            maxLength={definition.maxLength ?? 150}
            min={definition.type === "number" ? "0" : undefined}
            step={definition.type === "number" ? "0.01" : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        {error && (
          <span className="field-error" id={`${id}-error`}>
            {error}
          </span>
        )}
      </div>
    );
  };
  const summaryFields = (
    fields: readonly ApplicationField[],
    values: Record<string, string | string[]>,
  ) => (
    <dl className="application-summary">
      {fields.map((f) => (
        <div key={f.id}>
          <dt>{f.label}</dt>
          <dd>
            {Array.isArray(values[f.id])
              ? (values[f.id] as string[]).join(", ") || "None selected"
              : values[f.id] || "Not provided"}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <form
      action={formAction}
      noValidate
      className="employment-form"
      onSubmit={(event) => {
        if (step !== 7) {
          event.preventDefault();
          next();
          return;
        }
        if (deviceDraft.confirmationNeeded) {
          event.preventDefault();
          responseMessage.current?.focus();
          return;
        }
        const result = validateApplication(draft);
        setErrors(result.errors);
        if (Object.keys(result.errors).length) {
          event.preventDefault();
          const first = Object.keys(result.errors)[0];
          const found = applicationSteps.findIndex((s) =>
            s.fields.some((f) => f.id === first),
          );
          const target = first.startsWith("employers")
            ? 3
            : first.startsWith("references")
              ? 6
              : found >= 0
                ? found
                : 7;
          stepChanged.current = true;
          setStep(target);
          focusError(result.errors);
        } else {
          deviceDraft.markSubmission();
        }
      }}
      aria-describedby="application-instructions"
    >
      <div className="application-form-heading">
        <span className="eyebrow">
          <span />
          Employment application
        </span>
        <h3>Tell us about yourself.</h3>
        <p id="application-instructions">
          Fields marked * are required. Unfinished applications are
          automatically saved on this device for up to seven days. Drafts are
          not sent to us; your application is sent only when you submit it. On
          shared devices, use Discard Draft when finished.
        </p>
        <p>
          Do not include Social Security numbers, driver’s license numbers, or
          criminal-history details.
        </p>
      </div>
      <div className="application-draft-tools">
        <p className="application-helper" role="status">
          {deviceDraft.status ||
            "Your progress will be saved on this device as you enter answers."}
        </p>
        <button
          type="button"
          className="text-link"
          disabled={pending}
          onClick={startFresh}
        >
          Discard Draft
        </button>
      </div>
      {deviceDraft.confirmationNeeded && (
        <div
          className="form-message"
          role="alert"
          ref={responseMessage}
          tabIndex={-1}
        >
          A previous submission may already have been received. To avoid a
          duplicate, please <a href={`mailto:${business.email}`}>email us</a> or{" "}
          <a href={business.phoneHref}>call us</a> to confirm receipt before
          starting a new application. Your saved answers remain available for
          review.
        </div>
      )}
      <ol className="application-progress" aria-label="Application progress">
        {applicationSteps.map((item, i) => (
          <li key={item.title} aria-current={step === i ? "step" : undefined}>
            <span aria-hidden="true">{i + 1}</span>
            {item.title}
            {i < step && <span className="sr-only">Previously visited</span>}
          </li>
        ))}
      </ol>
      <p className="application-step-count" aria-live="polite">
        Step {step + 1} of {applicationSteps.length}
      </p>
      <h3 ref={heading} tabIndex={-1} className="application-step-heading">
        {applicationSteps[step].title}
      </h3>
      <fieldset disabled={pending} className="application-step-fields">
        <legend className="sr-only">{applicationSteps[step].title}</legend>
        <div className="form-grid">
          {applicationSteps[step].fields.map((f) =>
            field(f, draft.answers[f.id], (value) => setAnswer(f.id, value)),
          )}
        </div>
        {step === 1 && (
          <p className="application-helper">
            Overnight availability is welcome: an end time earlier than your
            start time means the following day (for example, 5:00 PM to 8:00
            AM). Earliest and latest times must be different.
          </p>
        )}
        {step === 2 && (
          <p className="application-helper">
            Share any education or training that applies. You may leave
            non-applicable fields blank.
          </p>
        )}
        {step === 3 && (
          <>
            <p>
              No previous employment? You can continue without adding an
              employer. Include up to three employers, most recent first.
            </p>
            {draft.employers.map((row, i) => (
              <fieldset key={i} className="application-row">
                <legend>Employer {i + 1}</legend>
                <div className="form-grid">
                  {employerFields.map((f) =>
                    field(
                      f,
                      row[f.id],
                      (value) => setRow("employers", i, f.id, value as string),
                      `employers.${i}.`,
                    ),
                  )}
                </div>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      employers: d.employers.filter((_, n) => n !== i),
                    }))
                  }
                >
                  Remove employer {i + 1}
                </button>
              </fieldset>
            ))}
            {allErrors.employers && (
              <p className="field-error">{allErrors.employers}</p>
            )}
            <button
              type="button"
              className="button button-outline"
              disabled={draft.employers.length >= 3}
              onClick={() =>
                setDraft((d) => ({ ...d, employers: [...d.employers, {}] }))
              }
            >
              Add previous employer
            </button>
          </>
        )}
        {step === 4 && (
          <p className="application-helper">
            New to cleaning? Enter 0 years and share any transferable skills.
          </p>
        )}
        {step === 5 && (
          <p className="application-helper">
            Do not enter your license number or screening information. Any
            required background or driving-record screening authorization is
            handled separately during hiring.
          </p>
        )}
        {step === 6 && (
          <>
            <p>
              Provide two references. Please ensure they are comfortable being
              contacted. A phone number is required; email is optional.
            </p>
            {draft.references.map((row, i) => (
              <fieldset key={i} className="application-row">
                <legend>Reference {i + 1}</legend>
                <div className="form-grid">
                  {referenceFields.map((f) =>
                    field(
                      f,
                      row[f.id],
                      (value) => setRow("references", i, f.id, value as string),
                      `references.${i}.`,
                    ),
                  )}
                </div>
              </fieldset>
            ))}
          </>
        )}
        {step === 7 && (
          <>
            <p>
              Review your answers before submitting. Use Edit to return to a
              section.
            </p>
            {applicationSteps.slice(0, 7).map((s, i) => (
              <section key={s.title} className="application-review-section">
                <div className="application-review-heading">
                  <h4>{s.title}</h4>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => changeStep(i)}
                    aria-label={`Edit ${s.title}`}
                  >
                    Edit
                  </button>
                </div>
                {i === 3 ? (
                  draft.employers.length ? (
                    draft.employers.map((row, n) => (
                      <div key={n}>
                        <h5>Employer {n + 1}</h5>
                        {summaryFields(employerFields, row)}
                      </div>
                    ))
                  ) : (
                    <p>No previous employers provided.</p>
                  )
                ) : i === 6 ? (
                  draft.references.map((row, n) => (
                    <div key={n}>
                      <h5>Reference {n + 1}</h5>
                      {summaryFields(referenceFields, row)}
                    </div>
                  ))
                ) : (
                  summaryFields(s.fields, draft.answers)
                )}
                {i === 1 && isOvernightAvailability(draft.answers) && (
                  <p className="application-helper">
                    Your latest availability time is on the following day
                    (overnight).
                  </p>
                )}
              </section>
            ))}
            <div className="application-certification">
              <h4>Applicant certification</h4>
              <p>{certificationText}</p>
              <label className="application-acknowledgment">
                <input
                  id="application-accepted"
                  type="checkbox"
                  required
                  checked={draft.accepted}
                  aria-invalid={!!allErrors.accepted}
                  aria-describedby={
                    allErrors.accepted
                      ? "application-accepted-error"
                      : undefined
                  }
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, accepted: e.target.checked }))
                  }
                />
                I have read and acknowledge the applicant certification. *
              </label>
              {allErrors.accepted && (
                <p className="field-error" id="application-accepted-error">
                  {allErrors.accepted}
                </p>
              )}
              {field(
                {
                  id: "acknowledgment",
                  label: "Typed applicant name",
                  required: true,
                },
                draft.acknowledgment,
                (value) =>
                  setDraft((d) => ({ ...d, acknowledgment: value as string })),
              )}
              <p className="application-helper">
                Your typed name records your acknowledgment. Any additional
                hiring documents or screening authorizations are handled
                separately. The submission date is recorded automatically when
                the application is saved.
              </p>
            </div>
          </>
        )}
      </fieldset>
      <input type="hidden" name="application" value={JSON.stringify(draft)} />
      <input type="hidden" name="application_token" value={token} />
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="application-website">Leave empty</label>
        <input
          id="application-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      {state.message && !deviceDraft.confirmationNeeded && (
        <div
          className="form-message"
          ref={responseMessage}
          role="alert"
          tabIndex={-1}
        >
          {state.message}
        </div>
      )}
      <div className="application-controls">
        {step > 0 && (
          <button
            type="button"
            className="button button-outline"
            disabled={pending}
            onClick={() => changeStep(step - 1)}
          >
            Back
          </button>
        )}
        {step < 7 ? (
          <button
            key="next"
            type="button"
            className="button"
            onClick={(event) => {
              event.preventDefault();
              next();
            }}
          >
            Next
          </button>
        ) : (
          <button
            key="submit"
            type="submit"
            className="button"
            disabled={pending}
          >
            {pending ? "Submitting application…" : "Submit Application"}
          </button>
        )}
      </div>
      <p className="application-helper">
        We use your application information to consider employment. Submitting
        does not guarantee a position or an interview.
      </p>
    </form>
  );
}
