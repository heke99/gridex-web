import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireSupportSession } from "@/support/lib/session";
import { StaffApiError } from "@/staff-api/client";
import { inviteUser, userCommand } from "@/support/app/actions";
import ActionForm from "@/support/components/ActionForm";
import { pageNumber } from "@/support/lib/presentation";
export default async function Team({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { api } = await requireSupportSession();
  const search = await searchParams;
  let users, roles;
  try {
    [users, roles] = await Promise.all([
      api.listUsers({ page: pageNumber(search.page), page_size: 25 }),
      api.listRoles(),
    ]);
  } catch (error) {
    if (error instanceof StaffApiError && error.status === 403)
      return (
        <section className="panel">
          <h1>Personal</h1>
          <p className="alert" role="alert">
            Ditt konto saknar behörighet att hantera personal. Kontakta din
            bolagsadministratör.
          </p>
        </section>
      );
    throw error;
  }
  const assignable = roles.data.filter((r) => r.assignable);
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Personal och roller</h1>
          <p className="muted">Gridex egna personalkonton och behörigheter.</p>
        </div>
      </div>
      <section className="panel">
        <details>
          <summary>Bjud in medarbetare</summary>
          <ActionForm
            action={inviteUser}
            idempotencyKey={randomUUID()}
            submit="Bjud in medarbetare"
          >
            <div className="grid">
              <label>
                Namn
                <input name="full_name" maxLength={200} />
              </label>
              <label>
                E-post
                <input name="email" type="email" required maxLength={320} />
              </label>
              <label>
                Roll
                <select name="role_key" required defaultValue="">
                  <option value="">Välj roll</option>
                  {assignable.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </ActionForm>
        </details>
      </section>
      <section className="panel">
        <h2>Medarbetare</h2>
        {users.data.map((u) => (
          <div className="panel" key={u.user_id}>
            <div className="row">
              <div>
                <h3>{u.full_name ?? u.email ?? "Medarbetare"}</h3>
                <p className="small muted">
                  {u.email} ·{" "}
                  {roles.data.find((r) => r.key === u.role_key)?.label ??
                    u.role_key}
                </p>
              </div>
              <span className="badge">
                {u.status === "active"
                  ? "Aktiv"
                  : u.status === "pending"
                    ? "Inbjuden"
                    : "Avstängd"}
              </span>
            </div>
            <details>
              <summary>Ändra roll eller åtkomst</summary>
              <ActionForm
                action={userCommand.bind(null, u.user_id, "role")}
                idempotencyKey={randomUUID()}
                submit="Spara roll"
              >
                <label>
                  Roll
                  <select
                    name="role_key"
                    defaultValue={
                      assignable.some((r) => r.key === u.role_key)
                        ? u.role_key
                        : ""
                    }
                    required
                  >
                    <option value="">Välj roll</option>
                    {assignable.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
              </ActionForm>
              <div style={{ marginTop: 20 }}>
                {u.status === "active" ? (
                  <ActionForm
                    action={userCommand.bind(null, u.user_id, "disable")}
                    idempotencyKey={randomUUID()}
                    submit="Stäng av åtkomst"
                  >
                    <label>
                      Anledning
                      <input name="reason" maxLength={500} />
                    </label>
                  </ActionForm>
                ) : u.status !== "pending" ? (
                  <ActionForm
                    action={userCommand.bind(null, u.user_id, "enable")}
                    idempotencyKey={randomUUID()}
                    submit="Aktivera åtkomst igen"
                  />
                ) : null}
              </div>
            </details>
          </div>
        ))}
        {users.data.length === 0 ? (
          <p className="muted">Inga medarbetare att visa.</p>
        ) : null}
        <div className="pager">
          {users.pagination.page > 1 ? (
            <Link
              className="button"
              href={`/team?page=${users.pagination.page - 1}`}
            >
              ← Föregående
            </Link>
          ) : null}
          {users.pagination.has_more ? (
            <Link
              className="button"
              href={`/team?page=${users.pagination.page + 1}`}
            >
              Nästa →
            </Link>
          ) : null}
        </div>
      </section>
      <section className="panel">
        <h2>Rollernas behörigheter</h2>
        {roles.data.map((r) => (
          <details key={r.key}>
            <summary>{r.label}</summary>
            <p className="muted">{r.description}</p>
            <p className="small">{r.permissions.join(", ")}</p>
          </details>
        ))}
      </section>
    </>
  );
}
