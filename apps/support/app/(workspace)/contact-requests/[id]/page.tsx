import Link from "next/link";
import { notFound } from "next/navigation";
import {
  publicInquiries,
  PUBLIC_INQUIRY_LABELS,
} from "@/support/lib/public-inquiries";
import { date } from "@/support/lib/presentation";
export const dynamic = "force-dynamic";
export default async function ContactRequest({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await publicInquiries.detail(id);
  if (!item) notFound();
  const searchLink = `/customers?${new URLSearchParams({ q: item.contact.email ?? item.contact.name ?? "" })}`;
  return (
    <>
      <p className="small">
        <Link href="/contact-requests">← Kontaktförfrågningar</Link>
      </p>
      <div className="heading">
        <div>
          <p className="eyebrow">Inkommande kontakt</p>
          <h1>{item.subject}</h1>
          <p className="muted">Inkom {date(item.createdAt)}</p>
        </div>
        <span className="badge">{PUBLIC_INQUIRY_LABELS[item.status]}</span>
      </div>
      <div className="detail-grid">
        <section className="panel">
          <h2>Meddelande</h2>
          <p className="pre">{item.description}</p>
        </section>
        <aside>
          <section className="panel">
            <h2>Uppgivna kontaktuppgifter</h2>
            <p className="small muted">
              Avsändaren har inte identifierats. Namn, e-post och telefon kommer
              från kontaktformuläret.
            </p>
            <dl>
              <dt>Namn</dt>
              <dd>{item.contact.name ?? "—"}</dd>
              <dt>E-post</dt>
              <dd>{item.contact.email ?? "—"}</dd>
              <dt>Telefon</dt>
              <dd>{item.contact.phone ?? "—"}</dd>
            </dl>
            <Link className="button" href={searchLink}>
              Sök i kundregistret →
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
