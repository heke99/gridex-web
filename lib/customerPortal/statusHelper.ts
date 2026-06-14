// Central helper for translating backend status codes to customer-friendly text.
// This file defines functions for displaying status labels, next step descriptions and missing field labels
// consistently across the customer portal. If a status or field is unknown the helper will return a safe fallback.

export function statusLabel(status?: string | null): string {
  // Normalize null/undefined to empty string
  const code = status ?? ''
  switch (code) {
    case 'application_received':
      return 'Ansökan mottagen'
    case 'needs_facility_data':
    case 'facility_data_requested':
      return 'Anläggningsuppgifter kontrolleras'
    case 'awaiting_customer_action':
      return 'Komplettering kan behövas'
    case 'awaiting_grid_owner_response':
      return 'Väntar på nätägare'
    case 'facility_verified':
      return 'Anläggning verifierad'
    case 'ready_for_switch':
      return 'Redo för nästa steg'
    case 'switch_requested':
      return 'Leverantörsbyte påbörjat'
    case 'switch_confirmed':
      return 'Leverantörsbyte bekräftat'
    case 'active_customer':
    case 'active':
      return 'Aktiv kund'
    case 'accepted':
      return 'Godkänt'
    case 'revoked':
      return 'Återkallad'
    case 'expired':
      return 'Utgången'
    case 'rejected_or_cancelled':
      return 'Avbruten eller nekad'
    default:
      // For unknown codes, replace underscores with spaces and fall back to a neutral message
      return code ? code.replaceAll('_', ' ') : 'Status uppdateras'
  }
}

export function statusDescription(status?: string | null): string {
  // Provides a short explanation for the given status when displaying on the thank-you page.
  const code = status ?? ''
  switch (code) {
    case 'needs_facility_data':
    case 'facility_data_requested':
      return 'Vi har tagit emot din ansökan och kontrollerar dina anläggningsuppgifter. Du behöver inte skicka in en ny ansökan.'
    case 'awaiting_customer_action':
      return 'Vi har tagit emot din ansökan. Om vi behöver komplettering kontaktar vi dig.'
    case 'awaiting_grid_owner_response':
      return 'Vi har tagit emot din ansökan och väntar på uppgifter från nätägaren.'
    case 'facility_verified':
      return 'Dina anläggningsuppgifter är verifierade och vi förbereder nästa steg.'
    case 'ready_for_switch':
      return 'Din ansökan är mottagen och uppgifterna är redo för nästa steg.'
    case 'switch_requested':
      return 'Din ansökan är mottagen och leverantörsbytet är påbörjat.'
    case 'switch_confirmed':
      return 'Ditt leverantörsbyte är bekräftat.'
    case 'active_customer':
    case 'active':
      return 'Ditt avtal är aktivt. Du kan följa dina uppgifter på Mina sidor.'
    case 'rejected_or_cancelled':
      return 'Ansökan kunde inte gå vidare. Kontakta oss om du vill veta mer.'
    default:
      return 'Vi har tagit emot din ansökan och går vidare med nästa steg.'
  }
}

export function nextStepDescription(step?: string | null): string {
  // Translate next step codes into human friendly descriptions.
  const code = step ?? ''
  switch (code) {
    case 'facility_data_requested':
      return 'Vi begär eller kontrollerar anläggningsuppgifter.'
    case 'awaiting_grid_owner_response':
      return 'Vi väntar på svar från nätägaren.'
    case 'awaiting_customer_action':
      return 'Vi kontaktar dig om något behöver kompletteras.'
    case 'ready_for_switch':
      return 'Vi förbereder leverantörsbyte.'
    case 'switch_requested':
      return 'Leverantörsbytet är skickat för behandling.'
    default:
      return code ? code.replaceAll('_', ' ') : 'Vi återkommer om vi behöver något mer.'
  }
}

export function missingFieldLabel(field: string | null | undefined): string {
  // Maps missing field identifiers returned from OPS to customer-friendly notes.
  switch (field) {
    case 'metering_point_id':
      return 'Mätpunkts-ID saknas eller behöver kontrolleras.'
    case 'facility_id':
      return 'Anläggnings-ID saknas eller behöver kontrolleras.'
    case 'facility_verified':
      return 'Anläggningsuppgifter behöver verifieras.'
    case 'power_of_attorney':
      return 'Fullmakt behöver sparas eller verifieras.'
    case 'requested_start_date':
      return 'Startdatum behöver kontrolleras.'
    default:
      return 'En uppgift behöver kontrolleras innan nästa steg.'
  }
}