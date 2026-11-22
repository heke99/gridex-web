import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import CasePages from "@/support/components/CasePages";
import AssigneeSelect from "@/support/components/AssigneeSelect";
import { listAssigneeOptions, type AssigneeOptions } from "@/support/lib/assignees";
import { CASE_PAGE_SIZE } from "@/support/lib/case-pages";
import { requireSupportSession } from "@/support/lib/session";
import {
  STATUS,
  PRIORITY,
  WRITE_STATUSES,
  date,
} from "@/support/lib/presentation";
import ActionForm from "@/support/components/ActionForm";
import { caseCommand } from "@/support/app/actions";
import { StaffApiError, type StaffApiClient } from "@/staff-api/client";
import AttachmentUpload from '../../../../../../components/support/AttachmentUpload';

export default async function Case({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{
    events_cursor?: string | string[];
    attachments_cursor?: string | string[];
  }>;
}) {
  const { api } = await requireSupportSession();
  const { reference } = await params;
  const search = await searchParams;
  const eventsCursor = typeof search.events_cursor === "string" ? search.events_cursor : undefined;
  const attachmentsCursor = typeof search.attachments_cursor === "string" ? search.attachments_cursor : undefined;
  const retryQuery = new URLSearchParams();
  if (eventsCursor) retryQuery.set("events_cursor", eventsCursor);
  if (attachmentsCursor) retryQuery.set("attachments_cursor", attachmentsCursor);
  const assigneeRetryHref = `/cases/${encodeURIComponent(reference)}${retryQuery.size ? `?${retryQuery}` : ""}`;
  const item = (await api.getCase(reference)).data;
  const [events, attachments] = await Promise.all([
    eventsCursor
      ? api.listEvents(reference, { limit: CASE_PAGE_SIZE, cursor: eventsCursor })
      : Promise.resolve({ data: item.events, page: item.events_page }),
    attachmentsCursor
      ? api.listAttachments(reference, {
          limit: CASE_PAGE_SIZE,
          cursor: attachmentsCursor,
        })
      : Promise.resolve({
          data: item.attachments,
          page: item.attachments_page,
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
          <CasePages
            key={reference}
            reference={reference}
            firstEvents={events}
            firstAttachments={attachments}
            eventsCursor={eventsCursor ?? null}
            attachmentsCursor={attachmentsCursor ?? null}
            upload={!['closed', 'resolved', 'cancelled'].includes(item.status)
              ? <AttachmentUpload endpoint={`/cases/${reference}/attachments`} staff /> : null}
          />
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
          <Suspense fallback={<p role="status">Hämtar medarbetare…</p>}>
            <CaseAssignee api={api} reference={reference} assigneeId={item.assignee_user_id} retryHref={assigneeRetryHref} />
          </Suspense>
        </aside>
      </div>
    </>
  );
}

async function CaseAssignee({ api, reference, assigneeId, retryHref }: {
  api: StaffApiClient; reference: string; assigneeId: string | null; retryHref: string
}) {
  let options: AssigneeOptions;
  try {
    options = await listAssigneeOptions(api, 1);
  } catch (error) {
    if (error instanceof StaffApiError && error.status === 403) return null;
    return (
      <section className="panel">
        <h2>Ansvarig</h2>
        <p role="alert">Medarbetarna kunde inte hämtas just nu.</p>
        <a href={retryHref}>Försök hämta medarbetare igen</a>
      </section>
    );
  }
  return (
    <section className="panel">
      <h2>Ansvarig</h2>
      <ActionForm
        action={caseCommand.bind(null, reference, "assignee")}
        idempotencyKey={randomUUID()}
        submit="Tilldela ärendet"
      >
        <AssigneeSelect key={assigneeId ?? ""} initial={options} assigneeId={assigneeId} />
      </ActionForm>
    </section>
  );
}
