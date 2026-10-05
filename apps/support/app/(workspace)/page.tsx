import Link from "next/link";
import { requireSupportSession } from "@/support/lib/session";
import { STATUS, PRIORITY, date } from "@/support/lib/presentation";
import type { StaffCaseQuery } from "@/staff-api/client";

export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    query?: string;
    cursor?: string;
    customer?: string;
  }>;
}) {
  const { api } = await requireSupportSession();
  const search = await searchParams;
  const status =
    search.status && Object.hasOwn(STATUS, search.status)
      ? (search.status as StaffCaseQuery["status"])
      : undefined;
  const query = search.query?.slice(0, 180) || undefined;
  const result = await api.listCases({
    limit: 25,
    status,
    query,
    cursor: search.cursor,
    customer_reference: search.customer,
  });
  const next = new URLSearchParams({
    ...(status ? { status } : {}),
    ...(query ? { query } : {}),
    ...(search.customer ? { customer: search.customer } : {}),
    cursor: result.page.next_cursor ?? "",
  });
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">Kundtjänst</p>
          <h1>Ärenden</h1>
          <p className="muted">Gridex kundärenden och uppföljning.</p>
        </div>
        <Link className="button primary" href="/cases/new">
          Nytt ärende
        </Link>
      </div>
      <section className="panel">
        <form className="filters" method="get">
          {search.customer ? (
            <input type="hidden" name="customer" value={search.customer} />
          ) : null}
          <label className="search">
            Sök ärenderubrik
            <input
              name="query"
              defaultValue={query}
              maxLength={180}
              placeholder="Sök bland ärenden…"
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={status ?? ""}>
              <option value="">Alla statusar</option>
              {Object.entries(STATUS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button>Sök</button>
        </form>
      </section>
      <section className="panel">
        <div className="row">
          <h2>Ärendekö</h2>
          <span className="small muted">
            {result.data.length} ärenden på den här sidan
          </span>
        </div>
        {result.data.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ärende</th>
                  <th>Status</th>
                  <th>Prioritet</th>
                  <th>Uppdaterat</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((row) => (
                  <tr key={row.case_reference}>
                    <td>
                      <Link
                        className="case-title"
                        href={`/cases/${row.case_reference}`}
                      >
                        {row.title}
                      </Link>
                      <p className="small muted">
                        {row.category ?? "Support"}
                        {row.assignee_user_id
                          ? " · Tilldelat"
                          : " · Ej tilldelat"}
                      </p>
                    </td>
                    <td>
                      <span className="badge">{STATUS[row.status]}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${["urgent", "high"].includes(row.priority) ? "urgent" : ""}`}
                      >
                        {PRIORITY[row.priority] ?? row.priority}
                      </span>
                    </td>
                    <td className="small muted">{date(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <h2>Inga ärenden att visa</h2>
            <p className="muted">
              Nya kundärenden visas här. Ändra sökningen om du använder ett
              filter.
            </p>
          </div>
        )}
        <div className="pager">
          {search.cursor ? (
            <Link
              className="button"
              href={`/?${new URLSearchParams({ ...(status ? { status } : {}), ...(query ? { query } : {}), ...(search.customer ? { customer: search.customer } : {}) })}`}
            >
              Till första sidan
            </Link>
          ) : null}
          {result.page.has_more ? (
            <Link className="button" href={`/?${next}`}>
              Nästa sida →
            </Link>
          ) : null}
        </div>
      </section>
    </>
  );
}
