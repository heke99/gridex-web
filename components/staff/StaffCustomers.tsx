'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { StaffClient } from './client'
import { staffDate, staffPath } from './client'
import type { StaffAddress, StaffContact, StaffCustomer, StaffCustomerDetail, StaffFacility } from './types'
import { useStaffPage } from './useStaffPage'
import { Feedback, field, panel, primary, PageControls, Value } from './ui'

export function StaffCustomerCard({ customer, client }: { customer: StaffCustomerDetail; client: StaffClient }) {
  const base = `/api/staff/customers/${staffPath(customer.customer_reference)}`
  const contacts = useStaffPage<StaffContact>(client, `${base}/contacts`, 'contact_reference')
  const addresses = useStaffPage<StaffAddress>(client, `${base}/addresses`, 'address_reference')
  const facilities = useStaffPage<StaffFacility>(client, `${base}/facilities`, 'facility_reference')
  return <article className={`${panel} space-y-6`} aria-labelledby="staff-customer-title">
    <div><p className="text-xs text-cyan-300">Kundkort · {customer.customer_number || 'Kundnummer saknas'}</p><h2 id="staff-customer-title" className="mt-1 text-xl font-semibold">{customer.display_name || 'Kund'}</h2></div>
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Value label="E-post">{customer.email}</Value><Value label="Telefon">{customer.phone}</Value><Value label="Kundtyp">{customer.customer_type}</Value><Value label="Status">{customer.status}</Value>
      <Value label="Förnamn">{customer.first_name}</Value><Value label="Efternamn">{customer.last_name}</Value><Value label="Företag">{customer.company_name}</Value><Value label="Personnummer (maskerat)">{customer.masked_personal_number}</Value><Value label="Organisationsnummer">{customer.org_number}</Value>
      <Value label="Lägenhetsnummer">{customer.apartment_number}</Value><Value label="Språk">{customer.preferred_language}</Value><Value label="Senast uppdaterad">{staffDate(customer.updated_at)}</Value><Value label="Utflyttad">{staffDate(customer.moved_out_at)}</Value><Value label="Kundrelation avslutad">{staffDate(customer.lifecycle_closed_at)}</Value>
    </dl>
    <section aria-label="Kundens kontaktpersoner"><h3 className="font-semibold">Kontaktpersoner</h3><ul className="mt-3 space-y-3">{contacts.rows.map((contact) => <li key={contact.contact_reference} className="rounded-xl border border-white/10 p-3"><p className="font-medium">{contact.name || 'Kontaktperson'}{contact.is_primary && <span className="ml-2 text-xs text-cyan-200">Primär</span>}</p><p className="mt-1 text-sm text-slate-300">{[contact.title, contact.type, contact.email, contact.phone].filter(Boolean).join(' · ') || 'Kontaktuppgifter saknas'}</p></li>)}</ul>{!contacts.loading && !contacts.error && !contacts.rows.length && <p className="mt-2 text-sm text-slate-400">Inga kontaktpersoner.</p>}<PageControls page={contacts} label="kontaktpersoner" /></section>
    <section aria-label="Kundens adresser"><h3 className="font-semibold">Adresser</h3><ul className="mt-3 space-y-3">{addresses.rows.map((address) => <li key={address.address_reference} className="rounded-xl border border-white/10 p-3"><p className="text-sm font-medium">{address.type || 'Adress'} · {address.is_active === true ? 'Aktiv' : address.is_active === false ? 'Inaktiv' : 'Status saknas'}</p><p className="mt-1 text-sm">{[address.street_1, address.street_2].filter(Boolean).join(', ')}<br />{[address.postal_code, address.city, address.country].filter(Boolean).join(' ')}</p><p className="mt-1 text-xs text-slate-400">{address.municipality || 'Kommun saknas'} · Inflyttad {staffDate(address.moved_in_at)} · Utflyttad {staffDate(address.moved_out_at)}</p></li>)}</ul>{!addresses.loading && !addresses.error && !addresses.rows.length && <p className="mt-2 text-sm text-slate-400">Inga adresser.</p>}<PageControls page={addresses} label="adresser" /></section>
    <section aria-label="Kundens anläggningar"><h3 className="font-semibold">Anläggningar</h3><ul className="mt-3 space-y-3">{facilities.rows.map((facility) => <li key={facility.facility_reference} className="rounded-xl border border-white/10 p-3"><p className="font-medium">{facility.site_name || 'Anläggning'} · {facility.status || 'Status saknas'}</p><dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><Value label="Anläggnings-ID">{facility.facility_id}</Value><Value label="Typ">{facility.site_type}</Value><Value label="Adress">{[facility.care_of, facility.street, facility.postal_code, facility.city, facility.country].filter(Boolean).join(', ')}</Value><Value label="Nätområde / elområde">{[facility.grid_area_code, facility.price_area_code].filter(Boolean).join(' / ')}</Value><Value label="Inflyttning">{staffDate(facility.move_in_date)}</Value><Value label="Utflyttning">{staffDate(facility.move_out_date)}</Value></dl></li>)}</ul>{!facilities.loading && !facilities.error && !facilities.rows.length && <p className="mt-2 text-sm text-slate-400">Inga anläggningar.</p>}<PageControls page={facilities} label="anläggningar" /></section>
  </article>
}

export default function StaffCustomers({ client, onSelect, selectedReference }: { client: StaffClient; onSelect: (customer: StaffCustomerDetail) => void; selectedReference?: string | null }) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<StaffCustomerDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const selection = useRef<AbortController | null>(null)
  const customers = useStaffPage<StaffCustomer>(client, `/api/staff/customers${query}`, 'customer_reference')
  useEffect(() => () => selection.current?.abort(), [])
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const q = String(values.get('q') ?? '').trim()
    if (q.length === 1) { setError('Ange minst två tecken för att söka.'); return }
    const filter = new URLSearchParams()
    if (q) filter.set('q', q)
    const type = String(values.get('customer_type') ?? '')
    if (type) filter.set('customer_type', type)
    const status = String(values.get('status') ?? '')
    if (status) filter.set('status', status)
    setError(null); setQuery(filter.size ? `?${filter}` : '')
    if ((filter.size ? `?${filter}` : '') === query) customers.refresh()
  }
  async function select(reference: string) {
    selection.current?.abort()
    const controller = new AbortController(); selection.current = controller
    setLoading(true); setDetail(null); setError(null)
    try {
      const result = await client.read<StaffCustomerDetail>(`/api/staff/customers/${staffPath(reference)}`, controller.signal)
      if (!controller.signal.aborted) { setDetail(result.data); onSelect(result.data) }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Kundkortet kunde inte hämtas.') }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }
  return <div className="space-y-5"><section className={panel} aria-labelledby="staff-customers-title"><h2 id="staff-customers-title" className="text-xl font-semibold">Kunder</h2>
    <form onSubmit={search} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm">Sök kund<input name="q" className={field} maxLength={120} placeholder="Namn, kundnummer, e-post eller telefon" /></label><label className="text-sm">Kundtyp<select name="customer_type" className={field}><option value="">Alla kundtyper</option><option value="private">Privat</option><option value="business">Företag</option><option value="association">Förening</option></select></label><label className="text-sm">Status<select name="status" className={field}><option value="">Alla statusar</option>{Object.entries({ draft: 'Utkast', pending_verification: 'Inväntar verifiering', active: 'Aktiv', inactive: 'Inaktiv', moved: 'Utflyttad', terminated: 'Avslutad', blocked: 'Spärrad', archived: 'Arkiverad' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className={primary}>Sök</button></form>
    <Feedback error={error} /><ul className="mt-4 divide-y divide-white/10">{customers.rows.map((customer) => <li key={customer.customer_reference}><button type="button" aria-pressed={selectedReference === customer.customer_reference} onClick={() => select(customer.customer_reference)} className="w-full rounded-xl px-2 py-4 text-left hover:bg-white/5 aria-pressed:bg-cyan-300/10"><span className="block font-medium">{customer.display_name || 'Kund'}</span><span className="mt-1 block break-words text-sm text-slate-400">{[customer.customer_number, customer.email, customer.phone, customer.status].filter(Boolean).join(' · ')}</span></button></li>)}</ul>
    {!customers.loading && !customers.error && !customers.rows.length && <p className="mt-4 text-sm text-slate-400">Inga kunder matchar sökningen.</p>}<PageControls page={customers} label="kunder" />
  </section>{loading && <p role="status">Hämtar kundkort…</p>}{detail && <StaffCustomerCard key={detail.customer_reference} customer={detail} client={client} />}</div>
}
