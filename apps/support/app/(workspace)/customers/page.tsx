import Link from "next/link";
import { requireSupportSession } from "@/support/lib/session";
import { pageNumber } from "@/support/lib/presentation";
import { StaffApiError } from "@/staff-api/client";
export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { api } = await requireSupportSession();
  const search = await searchParams;
  let result;
  try {
    result = await api.searchCustomers({
      q: search.q?.slice(0, 200),
      page: pageNumber(search.page),
      page_size: 25,
    });
  } catch (error) {
    if (error instanceof StaffApiError && error.status === 403)
      return (
        <section className="panel">
          <h1>Kunder</h1>
          <p className="alert" role="alert">
            Ditt konto saknar behörighet att läsa kunder.
          </p>
        </section>
      );
    throw error;
  }
  const { customers, pagination } = result.data;
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">Kundtjänst</p>
          <h1>Kunder</h1>
          <p className="muted">Gridex kunder och kontaktuppgifter.</p>
        </div>
      </div>
      <section className="panel">
        <form className="filters">
          <label>
            Sök kund
            <input
              name="q"
              maxLength={200}
              defaultValue={search.q}
              placeholder="Namn, e-post eller kundnummer"
            />
          </label>
          <button>Sök</button>
        </form>
      </section>
      <section className="panel">
        <div className="row">
          <h2>Kundregister</h2>
          <span className="small muted">{pagination.total} kunder</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kund</th>
                <th>Kundnummer</th>
                <th>E-post</th>
                <th>Telefon</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.customer_reference}>
                  <td>
                    <Link
                      className="case-title"
                      href={`/customers/${c.customer_reference}`}
                    >
                      {c.display_name ?? "Kund"}
                    </Link>
                  </td>
                  <td>{c.customer_number ?? "—"}</td>
                  <td>{c.email ?? "—"}</td>
                  <td>{c.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {customers.length === 0 ? (
          <p className="empty muted">Inga kunder matchar sökningen.</p>
        ) : null}
        <div className="pager">
          {pagination.page > 1 ? (
            <Link
              className="button"
              href={`/customers?${new URLSearchParams({ q: search.q ?? "", page: String(pagination.page - 1) })}`}
            >
              ← Föregående
            </Link>
          ) : null}
          {pagination.page < pagination.total_pages ? (
            <Link
              className="button"
              href={`/customers?${new URLSearchParams({ q: search.q ?? "", page: String(pagination.page + 1) })}`}
            >
              Nästa →
            </Link>
          ) : null}
        </div>
      </section>
    </>
  );
}
