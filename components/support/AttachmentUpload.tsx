'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { attachmentFileName, isSupportAttachmentType, MAX_SUPPORT_ATTACHMENT_BYTES } from '../../lib/support/attachmentRules'

export default function AttachmentUpload({ endpoint, staff = false }: { endpoint: string; staff?: boolean }) {
  const router = useRouter()
  const operation = useRef<string | null>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  return <form className="attachment-upload" aria-busy={pending} onSubmit={async event => {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const file = fields.get('file')
    setError(true)
    if (!(file instanceof File) || !file.size) { setMessage('Välj en fil att bifoga.'); return }
    if (file.size > MAX_SUPPORT_ATTACHMENT_BYTES) { setMessage('Filen får vara högst 4 MB.'); return }
    if (!isSupportAttachmentType(file.type)) { setMessage('Välj en PDF-, PNG- eller JPEG-fil.'); return }
    operation.current ??= crypto.randomUUID()
    setPending(true); setMessage('')
    try {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', redirect: 'error',
        headers: { 'Content-Type': file.type, 'X-File-Name': attachmentFileName(file.name), 'Idempotency-Key': operation.current,
          ...(staff ? { 'X-Attachment-Visibility': fields.get('visibility') === 'customer' ? 'customer' : 'internal' } : {}) }, body: file })
      if (!response.ok) {
        setMessage(response.status === 422 ? 'Filen kunde inte godkännas i innehållskontrollen.'
          : response.status === 413 ? 'Filen är för stor för uppladdning.'
          : response.status === 429 ? 'För många uppladdningar. Vänta en stund och försök igen.'
          : response.status === 401 || response.status === 403 ? 'Du saknar behörighet eller behöver logga in igen.'
          : response.status === 409 ? 'Ärendet eller filen kunde inte uppdateras. Ladda om sidan.'
          : 'Filen kunde inte laddas upp. Försök igen med samma fil.')
        return
      }
      setError(false); setMessage('Bilagan har skickats för innehållskontroll.')
      form.reset(); operation.current = null; router.refresh()
    } catch { setMessage('Uppladdningen kunde inte bekräftas. Försök igen med samma fil.') }
    finally { setPending(false) }
  }} onChange={() => { operation.current = null; setMessage('') }}>
    <label> Bifoga fil <input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required disabled={pending} /></label>
    {staff ? <label>Synlighet <select name="visibility" defaultValue="internal" disabled={pending}>
      <option value="internal">Endast personal</option><option value="customer">Synlig för kunden</option>
    </select></label> : null}
    <p className="small">PDF, PNG eller JPEG, högst 4 MB. Filen kontrolleras innan den kan laddas ner.</p>
    {message ? <p role={error ? 'alert' : 'status'}>{message}</p> : null}
    <button type="submit" disabled={pending}>{pending ? 'Laddar upp…' : 'Skicka bilaga'}</button>
  </form>
}
