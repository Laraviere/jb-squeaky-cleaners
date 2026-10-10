"use client";
import { useActionState, useState, useTransition } from "react";
import Image from "next/image";
import { mfaQrImageSource } from "@/lib/admin/mfa";
import { enrollMfa, login, setPassword, verifyMfa } from "@/app/admin/actions";
export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return (
    <form action={action} className="admin-form">
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </label>
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      <button className="admin-button" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
export function PasswordForm() {
  const [state, action, pending] = useActionState(setPassword, {});
  return (
    <form action={action} className="admin-form">
      <label>
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
      </label>
      <label>
        Confirm password
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
      </label>
      <p>Use at least 12 characters.</p>
      {state.error && (
        <p role="alert" className="admin-error">
          {state.error}
        </p>
      )}
      <button className="admin-button" disabled={pending}>
        Save password
      </button>
    </form>
  );
}
export function MfaForm({
  factors,
}: {
  factors: { id: string; friendly_name?: string }[];
}) {
  const [state, action, pending] = useActionState(verifyMfa, {});
  const [enrollment, setEnrollment] = useState<
    Awaited<ReturnType<typeof enrollMfa>>
  >({});
  const [enrolling, startTransition] = useTransition();
  const factorId = enrollment.factorId || factors[0]?.id;
  return (
    <div>
      {!factorId && (
        <>
          <p>
            Protect your staff account using an authenticator app. Scan the QR
            code, then enter its six-digit code.
          </p>
          <button
            className="admin-button"
            disabled={enrolling}
            onClick={() =>
              startTransition(async () => {
                try {
                  setEnrollment(await enrollMfa());
                } catch {
                  setEnrollment({
                    error: "Setup could not be reached. Try again.",
                  });
                }
              })
            }
          >
            {enrolling ? "Preparing…" : "Set up authenticator"}
          </button>
        </>
      )}
      {enrollment.error && (
        <p role="alert" className="admin-error">
          {enrollment.error}
        </p>
      )}
      {enrollment.qr && (
        <div className="admin-mfa-qr">
          <Image
            src={mfaQrImageSource(enrollment.qr)}
            alt="Authenticator enrollment QR code"
            width={220}
            height={220}
            unoptimized
          />
          <details>
            <summary>Cannot scan the QR code?</summary>
            <p>Enter this setup key in your authenticator:</p>
            <code>{enrollment.secret}</code>
          </details>
          <p>Keep this setup key private.</p>
        </div>
      )}
      {factorId && (
        <form action={action} className="admin-form">
          {factors.length > 1 ? (
            <div className="admin-field">
              <label htmlFor="mfa-factor">Authenticator</label>
              <select id="mfa-factor" name="factorId">
                {factors.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.friendly_name || "Authenticator"}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input name="factorId" value={factorId} type="hidden" />
          )}
          <label>
            Six-digit code
            <input
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
            />
          </label>
          {state.error && (
            <p role="alert" className="admin-error">
              {state.error}
            </p>
          )}
          <button className="admin-button" disabled={pending}>
            {pending ? "Verifying…" : "Verify and continue"}
          </button>
        </form>
      )}
    </div>
  );
}
