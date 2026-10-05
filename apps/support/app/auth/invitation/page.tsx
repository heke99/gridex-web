import { randomUUID } from "node:crypto";
import Link from "next/link";
import InvitationForm from "@/support/components/InvitationForm";
import { acceptInvitation } from "./actions";

export const dynamic = "force-dynamic";

/** Rendering/scanning the email link creates no membership or role grants. */
export default async function InvitationPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    code?: string;
    token_hash?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;
  const token =
    typeof params.token === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      params.token,
    )
      ? params.token
      : "";
  return (
    <main className="login-wrap">
      <div className="login">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <span>
            Gridex Support<small>Arbetsyta för kundtjänst</small>
          </span>
        </div>
        <section className="panel">
          <p className="eyebrow">Personalinbjudan</p>
          <h1>Acceptera din inbjudan</h1>
          <p className="muted">
            Välj ett personligt lösenord för ditt konto. Du får den roll och
            åtkomst som din bolagsadministratör har tilldelat dig.
          </p>
          {token ? (
            <InvitationForm
              action={acceptInvitation}
              token={token}
              code={typeof params.code === "string" ? params.code : ""}
              tokenHash={
                typeof params.token_hash === "string" ? params.token_hash : ""
              }
              type={typeof params.type === "string" ? params.type : ""}
              idempotencyKey={randomUUID()}
            />
          ) : (
            <p className="alert" role="alert">
              Inbjudningslänken är ogiltig. Be din bolagsadministratör skicka en
              ny inbjudan.
            </p>
          )}
          <p className="small muted">
            Inbjudan accepteras först när du skickar formuläret.
          </p>
          <Link href="/login">Till personalinloggningen</Link>
        </section>
      </div>
    </main>
  );
}
