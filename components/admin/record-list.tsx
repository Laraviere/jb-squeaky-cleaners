import Link from "next/link";
import { listRecords, formatDate, type ListParams } from "@/lib/admin/data";
import { type RecordKind, statuses, statusLabel } from "@/lib/admin/workflow";
export async function RecordList({
  kind,
  params,
}: {
  kind: RecordKind;
  params: ListParams;
}) {
  const data = await listRecords(kind, params),
    title = kind === "quotes" ? "Quote Requests" : "Employment Applications";
  const url = (page: number) =>
    `/admin/${kind}?${new URLSearchParams({ q: data.q, status: data.status, sort: data.sort, page: String(page) })}`;
  return (
    <>
      <header className="admin-page-header">
        <p className="admin-eyebrow">Incoming requests</p>
        <h1>{title}</h1>
        <p>
          {kind === "quotes"
            ? "Review customer requests and keep the next steps organized."
            : "Review applicant submissions and track hiring decisions."}
        </p>
      </header>
      <section className="admin-panel">
        <form className="admin-filters" action={`/admin/${kind}`}>
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
            <label htmlFor="filter-sort">Submission date</label>
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
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Name / email">
                      <Link href={`/admin/${kind}/${row.id}`}>{row.name}</Link>
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
    </>
  );
}
