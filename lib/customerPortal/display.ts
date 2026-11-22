export { formatCustomerDate } from '../../packages/mobile-foundation/src/customerDate'

export function formatCustomerCurrency(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return 'Inväntas'
  // Preserve the amount without silently changing an invalid currency to SEK.
  try {
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: currency || 'SEK' }).format(value)
  } catch {
    return `${new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} (valuta saknas)`
  }
}

export function customerInvoiceStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'paid': return 'Betald'
    case 'overdue': return 'Förfallen'
    case 'sent':
    case 'issued': return 'Skickad'
    case 'draft': return 'Förbereds'
    case 'cancelled': return 'Makulerad'
    case 'credited': return 'Krediterad'
    default: return 'Status uppdateras'
  }
}
