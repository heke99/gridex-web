import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireSupportSession } from "@/support/lib/session";
import {
  STATUS,
  PRIORITY,
  WRITE_STATUSES,
  date,
} from "@/support/lib/presentation";
import ActionForm from "@/support/components/ActionForm";
import { caseCommand } from "@/support/app/actions";
import { StaffApiError } from "@/staff-api/client";

export default async function Case({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{
    events_cursor?: string;
    attachments_cursor?: string;
  }>;
}) {
  const { api } = await requireSupportSession();
  const { reference } = await params;
  const search = await searchParams;
  const item = (await api.getCase(reference)).data;
  const [events, attachments, users] = await Promise.all([
    search.events_cursor
      ? api.listEvents(reference, { limit: 25, cursor: search.events_cursor })
      : Promise.resolve({ data: item.events, page: item.events_page }),
    search.attachments_cursor
      ? api.listAttachments(reference, {
          limit: 25,
          cursor: search.attachments_cursor,
        })
      : Promise.resolve({
          data: item.attachments,
          page: item.attachments_page,
        }),
    api.listUsers({ page_size: 100, status: "active" }).catch((error) => {
      if (error instanceof StaffApiError && error.status === 403) return null;
      throw error;
    }),
  ]);
  return (
    <>
      <p className="small">
        <Link href="/">← Alla ärenden</Link>
      </p>
      <div className="heading">
        <div>
          <p className="eyebrow">Supportärende</p>
          <h1>{item.title}</h1>
          <p className="muted">
            Skapat {date(item.created_at)} ·{" "}
            {PRIORITY[item.priority] ?? item.priority} prioritet
          </p>
        </div>
        <span className="badge">{STATUS[item.status]}</span>
      </div>
      <div className="detail-grid">
        <div>
          <section className="panel">
            <h2>Ärendet</h2>
            <p className="pre">{item.description ?? "Ingen beskrivning."}</p>
            <p className="small">
              <Link href={`/customers/${item.customer_reference}`}>
                Öppna kunden →
              </Link>
            </p>
          </section>
          <section className="panel">
            <h2>Historik</h2>
            <ol className="timeline">
              {events.data.map((event) => (
                <li
                  key={event.event_reference}
                  className={`event ${event.visibility === "internal" ? "internal" : ""}`}
                >
                  <div className="row small">
                    <strong>
                      {event.author_type === "customer"
                        ? "Kunden"
                        : event.event_type.includes("phone")
                          ? "Telefonsamtal"
                          : event.visibility === "internal"
                            ? "Intern anteckning"
                            : "Svar till kund"}
                    </strong>
                    <span className="muted">{date(event.created_at)}</span>
                  </div>
                  <p className="pre">{event.message}</p>
                  <span
                    className={`badge ${event.visibility === "internal" ? "internal" : ""}`}
                  >
                    {event.visibility === "internal"
                      ? "Endast personal"
                      : "Synligt för kunden"}
                  </span>
                </li>
              ))}
            </ol>
            {events.data.length === 0 ? (
              <p className="muted">Ingen historik ännu.</p>
            ) : null}
            <div className="pager">
              {search.events_cursor ? (
                <Link href={`/cases/${reference}`}>Senaste händelserna</Link>
              ) : null}
              {events.page.has_more ? (
                <Link
                  className="button"
                  href={`/cases/${reference}?${new URLSearchParams({ events_cursor: events.page.next_cursor! })}`}
                >
                  Äldre händelser →
                </Link>
              ) : null}
            </div>
          </section>
          <section className="panel">
            <h2>Bilagor</h2>
            <ul className="attachments">
              {attachments.data.map((file) => (
                <li className="row" key={file.attachment_reference}>
                  <div>
                    <strong>{file.file_name}</strong>
                    <p className="small muted">
                      {Math.ceil(file.byte_size / 1024)} kB ·{" "}
                      {file.visibility === "internal"
                        ? "Endast personal"
                        : "Synlig för kunden"}
                    </p>
                  </div>
                  {file.scan_status === "released" ? (
                    <a
                      className="button"
                      href={`/cases/${reference}/attachments/${file.attachment_reference}`}
                    >
                      Ladda ner
                    </a>
                  ) : (
                    <span className="badge">
                      {file.scan_status === "rejected"
                        ? "Stoppad i kontrollen"
                        : "Kontrolleras"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {attachments.data.length === 0 ? (
              <p className="muted">Inga bilagor.</p>
            ) : null}
            {attachments.page.has_more ? (
              <div className="pager">
                <Link
                  href={`/cases/${reference}?${new URLSearchParams({ attachments_cursor: attachments.page.next_cursor! })}`}
                >
                  Fler bilagor →
                </Link>
              </div>
            ) : null}
          </section>
        </div>
        <aside>
          <section className="panel">
            <h2>Svara kunden</h2>
            <ActionForm
              action={caseCommand.bind(null, reference, "reply")}
              idempotencyKey={randomUUID()}
              submit="Spara svar till kunden"
            >
              <label>
                Meddelande
                <textarea name="message" required maxLength={8000} rows={5} />
              </label>
              <p className="small muted">Svaret visas för kunden i ärendet.</p>
            </ActionForm>
          </section>
          <section className="panel">
            <details>
              <summary>Intern anteckning</summary>
              <ActionForm
                action={caseCommand.bind(null, reference, "note")}
                idempotencyKey={randomUUID()}
                submit="Spara anteckning"
              >
                <label>
                  Anteckning
                  <textarea name="message" required maxLength={8000} />
                </label>
                <p className="small muted">Visas enbart för personal.</p>
              </ActionForm>
            </details>
          </section>
          <section className="panel">
            <details>
              <summary>Registrera telefonsamtal</summary>
              <ActionForm
                action={caseCommand.bind(null, reference, "phone")}
                idempotencyKey={randomUUID()}
                submit="Spara samtal"
              >
                <label>
                  Riktning
                  <select name="direction">
                    <option value="inbound">Inkommande</option>
                    <option value="outbound">Utgående</option>
                  </select>
                </label>
                <label>
                  Sammanfattning
                  <textarea name="summary" required maxLength={8000} />
                </label>
                <label>
                  Kundidentifiering
                  <select name="verification_method" defaultValue="unverified">
                    <option value="unverified">Inte verifierad</option>
                    <option value="strong_eid">E-legitimation</option>
                    <option value="authenticated_portal_confirmation">
                      Bekräftat i kundportalen
                    </option>
                    <option value="callback_registered_number">
                      Återuppringning till registrerat nummer
                    </option>
                  </select>
                </label>
                <label>
                  Verifieringsreferens
                  <input name="verification_reference" maxLength={120} />
                </label>
              </ActionForm>
            </details>
          </section>
          <section className="panel">
            <h2>Status</h2>
            <ActionForm
              action={caseCommand.bind(null, reference, "status")}
              idempotencyKey={randomUUID()}
              submit="Ändra status"
            >
              <label>
                Ärendestatus
                <select
                  name="status"
                  defaultValue={
                    WRITE_STATUSES.some((s) => s === item.status)
                      ? item.status
                      : "open"
                  }
                >
                  {WRITE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS[s]}
                    </option>
                  ))}
                </select>
              </label>
            </ActionForm>
          </section>
          {users ? (
            <section className="panel">
              <h2>Ansvarig</h2>
              <ActionForm
                action={caseCommand.bind(null, reference, "assignee")}
                idempotencyKey={randomUUID()}
                submit="Tilldela ärendet"
              >
                <label>
                  Medarbetare
                  <select
                    name="assignee_user_id"
                    defaultValue={item.assignee_user_id ?? ""}
                  >
                    <option value="">Ej tilldelat</option>
                    {users.data.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.full_name ?? u.email ?? "Medarbetare"}
                      </option>
                    ))}
                  </select>
                </label>
              </ActionForm>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
