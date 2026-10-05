import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireSupportSession } from "@/support/lib/session";
import ActionForm from "@/support/components/ActionForm";
import { createCase } from "@/support/app/actions";

export default async function NewCase({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; customer?: string }>;
}) {
  const { api } = await requireSupportSession();
  const search = await searchParams;
  const selectedCustomer = search.customer
    ? (await api.getCustomer(search.customer)).data.customer
    : null;
  const customers = await api.searchCustomers({
    q: search.q?.slice(0, 200),
    page_size: 50,
  });
  const customerOptions = selectedCustomer
    ? [
        selectedCustomer,
        ...customers.data.customers.filter(
          (customer) =>
            customer.customer_reference !== selectedCustomer.customer_reference,
        ),
      ]
    : customers.data.customers;
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">Kundtjänst</p>
          <h1>Nytt ärende</h1>
        </div>
        <Link href="/">Till ärendekön</Link>
      </div>
      <section className="panel">
        <h2>Hitta kunden</h2>
        <form className="filters">
          {selectedCustomer ? (
            <input
              type="hidden"
              name="customer"
              value={selectedCustomer.customer_reference}
            />
          ) : null}
          <label>
            Sök kund
            <input
              name="q"
              defaultValue={search.q}
              placeholder="Namn eller kundnummer"
              maxLength={200}
            />
          </label>
          <button>Sök kund</button>
        </form>
      </section>
      <section className="panel">
        <ActionForm
          action={createCase}
          idempotencyKey={randomUUID()}
          submit="Skapa ärende"
        >
          <label>
            Kund
            <select
              name="customer_reference"
              required
              defaultValue={selectedCustomer?.customer_reference ?? ""}
            >
              <option value="">Välj kund</option>
              {customerOptions.map((c) => (
                <option key={c.customer_reference} value={c.customer_reference}>
                  {c.display_name ?? c.customer_number ?? "Kund"}
                  {c.customer_number ? ` · ${c.customer_number}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rubrik
            <input name="title" required maxLength={180} />
          </label>
          <label>
            Beskrivning
            <textarea name="description" maxLength={8000} rows={5} />
          </label>
          <label>
            Prioritet
            <select name="priority" defaultValue="normal">
              <option value="low">Låg</option>
              <option value="normal">Normal</option>
              <option value="high">Hög</option>
              <option value="urgent">Akut</option>
            </select>
          </label>
        </ActionForm>
      </section>
    </>
  );
}
