import Link from "next/link";
import { listRecords, formatDate, type ListParams } from "@/lib/admin/data";
import { type RecordKind, statuses, statusLabel } from "@/lib/admin/workflow";
export async function RecordList({
  kind,
  params,
  trash = false,
}: {
  kind: RecordKind;
  params: ListParams;
  trash?: boolean;
}) {
  const data = await listRecords(kind, params, trash),
    title = kind === "quotes" ? "Quote Requests" : "Employment Applications";
  const base = `/admin/${kind}${trash ? "/trash" : ""}`;
  const url = (page: number) =>
    `${base}?${new URLSearchParams({ q: data.q, status: data.status, sort: data.sort, page: String(page) })}`;
  return (
    <>
      <header className="admin-page-header">
        <p className="admin-eyebrow">Incoming requests</p>
        <h1>{title}{trash ? " · Trash" : ""}</h1>
        <p>
          {kind === "quotes"
            ? "Review customer requests and keep the next steps organized."
            : "Review applicant submissions and track hiring decisions."}
        </p>
      </header>
      {data.administrator && <nav className="admin-record-tabs" aria-label={`${title} views`}>
        <Link href={`/admin/${kind}`} aria-current={!trash ? "page" : undefined}>Active records</Link>
        <Link href={`/admin/${kind}/trash`} aria-current={trash ? "page" : undefined}>Trash</Link>
      </nav>}
      <section className="admin-panel">
        <form className="admin-filters" action={base}>
          <label>
            Search name or email
            <input
              type="search"
              name="q"
              defaultValue={data.q}
              maxLength={200}
            />
          </label>
          <div className="admin-field">
            <label htmlFor="filter-status">Status</label>
            <select id="filter-status" name="status" defaultValue={data.status}>
              <option value="">All statuses</option>
              {statuses(kind).map((s) => (
                <option value={s} key={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label htmlFor="filter-sort">{trash ? "Deletion date" : "Submission date"}</label>
            <select id="filter-sort" name="sort" defaultValue={data.sort}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <button className="admin-button">Apply filters</button>
        </form>
        <p className="admin-result-count">
          {data.total} {data.total === 1 ? "record" : "records"} · Page{" "}
          {data.page} of {Math.max(1, Math.ceil(data.total / 20))}
        </p>
        {data.rows.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr>
                  <th scope="col">Name / email</th>
                  <th scope="col">
                    {kind === "quotes" ? "Service" : "Position"}
                  </th>
                  <th scope="col">Submitted (Eastern)</th>
                  <th scope="col">Status</th>
                  {trash && <th scope="col">Deleted / staff</th>}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Name / email">
                      <Link href={`${base}/${row.id}`}>{row.name}</Link>
                      <span>{row.email}</span>
                    </td>
                    <td data-label={kind === "quotes" ? "Service" : "Position"}>
                      {row.service_type}
                    </td>
                    <td data-label="Submitted (Eastern)">
                      {formatDate(row.submitted_at)}
                    </td>
                    <td data-label="Status">
                      <span className="admin-status">
                        {statusLabel(row.workflow_status)}
                      </span>
                    </td>
                    {trash && <td data-label="Deleted / staff">{row.deleted_at && formatDate(row.deleted_at)}<small>Staff ID: {row.deleted_by}</small>{row.legal_hold && <span className="admin-status">Legal hold</span>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty">
            No matching records. Try changing your filters.
          </div>
        )}
        <nav className="admin-pagination" aria-label="Pagination">
          {data.page > 1 && (
            <Link href={url(data.page - 1)}>Previous page</Link>
          )}
          {data.page * 20 < data.total && (
            <Link href={url(data.page + 1)}>Next page</Link>
          )}
        </nav>
      </section>
      {trash && <section className="admin-panel">
        <h2>Permanent deletion history</h2>
        <p>Latest 20 deletion receipts. Customer and applicant content is not retained here. Receipts are kept for at least 24 months; legal holds extend retention.</p>
        {data.receipts.length ? <ul className="admin-activity">{data.receipts.map((receipt) => <li key={receipt.record_id}>
          <strong>Record ID: {receipt.record_id}</strong>
          <time dateTime={receipt.deleted_at}>{formatDate(receipt.deleted_at)}</time>
          <small>Deleted by staff ID: {receipt.actor_id}</small>
          <small>Retain through {formatDate(receipt.retain_until)}{receipt.legal_hold ? " · Legal hold active" : ""}</small>
        </li>)}</ul> : <p>No permanent deletions recorded.</p>}
      </section>}
    </>
  );
}
