"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <section className="admin-panel" role="alert">
      <h1>Unable to load this page</h1>
      <p>
        The request was not confirmed. Check your connection and try again.
        Refresh a record before retrying any changes.
      </p>
      <button className="admin-button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
