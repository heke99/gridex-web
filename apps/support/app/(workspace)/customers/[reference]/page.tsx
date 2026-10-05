import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireSupportSession } from "@/support/lib/session";
import ActionForm from "@/support/components/ActionForm";
import { customerContact } from "@/support/app/actions";
export default async function Customer({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { api } = await requireSupportSession();
  const { reference } = await params;
  const c = (await api.getCustomer(reference)).data.customer;
  return (
    <>
      <p className="small">
        <Link href="/customers">← Alla kunder</Link>
      </p>
      <div className="heading">
        <div>
          <p className="eyebrow">Kundkort</p>
          <h1>{c.display_name ?? "Kund"}</h1>
          <p className="muted">Kundnummer {c.customer_number ?? "—"}</p>
        </div>
        <Link
          className="button primary"
          href={`/cases/new?customer=${encodeURIComponent(reference)}`}
        >
          Nytt ärende för kunden
        </Link>
      </div>
      <div className="grid">
        <section className="panel">
          <h2>Kontaktuppgifter</h2>
          <dl>
            <dt>E-post</dt>
            <dd>{c.email ?? "—"}</dd>
            <dt>Telefon</dt>
            <dd>{c.phone ?? "—"}</dd>
            <dt>Fakturaadress, e-post</dt>
            <dd>{c.invoice_email ?? "—"}</dd>
            <dt>Person-/organisationsnummer</dt>
            <dd>{c.personal_number_masked ?? c.org_number_masked ?? "—"}</dd>
          </dl>
          <h2>Ändra kontaktuppgift</h2>
          <ActionForm
            action={customerContact.bind(null, reference)}
            idempotencyKey={randomUUID()}
          >
            <input
              type="hidden"
              name="expected_updated_at"
              value={c.updated_at ?? ""}
            />
            <label>
              Uppgift
              <select name="field">
                <option value="email">E-post</option>
                <option value="phone">Telefon</option>
                <option value="invoice_email">Fakturaadress, e-post</option>
                <option value="preferred_language">Språk</option>
                <option value="apartment_number">Lägenhetsnummer</option>
              </select>
            </label>
            <label>
              Nytt värde
              <input name="value" required maxLength={320} />
            </label>
          </ActionForm>
        </section>
        <section className="panel">
          <h2>Adresser</h2>
          {c.addresses.map((a) => (
            <p key={a.address_reference}>
              {a.street_1}
              <br />
              {a.postal_code} {a.city}
            </p>
          ))}
          {c.addresses.length === 0 ? (
            <p className="muted">Inga adresser.</p>
          ) : null}
          <h2 style={{ marginTop: 24 }}>Anläggningar</h2>
          {c.sites.map((s) => (
            <p key={s.facility_reference}>
              <strong>{s.site_name ?? s.facility_id ?? "Anläggning"}</strong>
              <br />
              <span className="muted">
                {s.street} {s.city}
              </span>
            </p>
          ))}
          {c.sites.length === 0 ? (
            <p className="muted">Inga anläggningar.</p>
          ) : null}
          <Link href={`/?customer=${encodeURIComponent(reference)}`}>
            Visa kundens ärenden →
          </Link>
        </section>
      </div>
    </>
  );
}
