import 'server-only'

/** Deliberately excludes raw upstream messages, response bodies and credentials. */
export class StaffApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null
  readonly retryable: boolean

  constructor(status: number, code: string, requestId: string | null = null, retryable = false) {
    const message = status === 401 ? 'Logga in igen för att fortsätta.'
      : status === 403 ? 'Du saknar behörighet för den här åtgärden.'
      : status === 404 ? 'Ärendet eller uppgiften kunde inte hittas.'
      : status === 409 ? 'Uppgiften har ändrats. Uppdatera sidan innan du försöker igen.'
      : status === 422 || status === 400 ? 'Kontrollera uppgifterna och försök igen.'
      : status === 429 ? 'För många anrop. Vänta en stund innan du försöker igen.'
      : 'Supporttjänsten kunde inte slutföra anropet.'
    super(message)
    this.name = 'StaffApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
    this.retryable = retryable
  }

  toJSON() {
    return { name: this.name, message: this.message, status: this.status, code: this.code, request_id: this.requestId, retryable: this.retryable }
  }
}
