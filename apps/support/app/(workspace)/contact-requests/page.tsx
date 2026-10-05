import Link from "next/link";
import {
  publicInquiries,
  PUBLIC_INQUIRY_STATUSES,
  PUBLIC_INQUIRY_LABELS,
} from "@/support/lib/public-inquiries";
import { date, pageNumber } from "@/support/lib/presentation";
export const dynamic = "force-dynamic";
export default async function ContactRequests({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const search = await searchParams;
  const result = await publicInquiries.list({
    page: pageNumber(search.page),
    status: search.status || undefined,
  });
  const pageLink = (page: number) =>
    `/contact-requests?${new URLSearchParams({ page: String(page), ...(search.status ? { status: search.status } : {}) })}`;
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">Inkommande kontakt</p>
          <h1>Kontaktförfrågningar</h1>
          <p className="muted">
            Meddelanden från Gridex offentliga kontaktformulär.
            Kontaktuppgifterna är inte verifierade.
          </p>
        </div>
      </div>
      <section className="panel">
        <form className="filters">
          <label>
            Status
            <select name="status" defaultValue={search.status ?? ""}>
              <option value="">Alla</option>
              {PUBLIC_INQUIRY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {PUBLIC_INQUIRY_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <button>Visa</button>
        </form>
      </section>
      <section className="panel">
        <div className="row">
          <h2>Inkomna förfrågningar</h2>
          <span className="small muted">{result.total} förfrågningar</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ämne</th>
                <th>Uppgivet namn</th>
                <th>Uppgiven e-post</th>
                <th>Status</th>
                <th>Inkom</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      className="case-title"
                      href={`/contact-requests/${item.id}`}
                    >
                      {item.subject}
                    </Link>
                  </td>
                  <td>{item.contact.name ?? "—"}</td>
                  <td>{item.contact.email ?? "—"}</td>
                  <td>
                    <span className="badge">
                      {PUBLIC_INQUIRY_LABELS[item.status]}
                    </span>
                  </td>
                  <td className="small">{date(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.items.length === 0 ? (
          <p className="empty muted">
            Inga kontaktförfrågningar matchar filtret.
          </p>
        ) : null}
        <div className="pager">
          {result.page > 1 ? (
            <Link className="button" href={pageLink(result.page - 1)}>
              ← Föregående
            </Link>
          ) : null}
          {result.page < result.totalPages ? (
            <Link className="button" href={pageLink(result.page + 1)}>
              Nästa →
            </Link>
          ) : null}
        </div>
      </section>
    </>
  );
}
