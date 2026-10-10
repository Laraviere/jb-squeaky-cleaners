import Link from "next/link";
import { dashboardData, formatDate } from "@/lib/admin/data";
import { statusLabel } from "@/lib/admin/workflow";
export default async function DashboardPage() {
  const data = await dashboardData();
  const cards = [
    ["Quote requests", data.quotes, "/admin/quotes"],
    ["New quote requests", data.newQuotes, "/admin/quotes?status=new"],
    ["Employment applications", data.applications, "/admin/applications"],
    [
      "New applications",
      data.newApplications,
      "/admin/applications?status=new",
    ],
  ] as const;
  return (
    <>
      <header className="admin-page-header">
        <p className="admin-eyebrow">JB Squeaky Cleaners</p>
        <h1>Dashboard</h1>
        <p>Your overview of incoming requests and staff activity.</p>
      </header>
      <div className="admin-stats">
        {cards.map(([label, value, href]) => (
          <Link href={href} className="admin-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </Link>
        ))}
      </div>
      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <h2>Recent submissions</h2>
          {data.recent.length ? (
            <ul className="admin-activity">
              {data.recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/${r.kind}/${r.id}`}>
                    {r.kind === "quotes"
                      ? "Quote request"
                      : "Employment application"}
                  </Link>
                  <time dateTime={r.date}>{formatDate(r.date)}</time>
                </li>
              ))}
            </ul>
          ) : (
            <p>No submissions yet.</p>
          )}
        </section>
        <section className="admin-panel">
          <h2>Recent staff activity</h2>
          {data.activity.length ? (
            <ul className="admin-activity">
              {data.activity.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/${a.quote_id ? "quotes" : "applications"}/${a.quote_id || a.application_id}`}
                  >
                    {a.quote_id ? "Quote" : "Application"} ·{" "}
                    {a.action === "note_added"
                      ? "Internal note added"
                      : `Status changed to ${statusLabel(a.new_status || "new")}`}
                  </Link>
                  <time dateTime={a.created_at}>
                    {formatDate(a.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No staff activity yet. Recorded status changes and notes will
              appear here.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
