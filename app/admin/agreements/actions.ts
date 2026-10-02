'use server'

import { finalizeAgreement } from '@/lib/contracts/finalizeAgreement'
import { requireAdminActionAccess } from '@/lib/admin/guards'

export async function finalizeAgreementAction(
  agreementId: string
): Promise<void> {
  // 🔐 1. Session-bunden auth (RLS enforced)
  await requireAdminActionAccess({ allOf: ['agreements.write'] })

  // 🔎 2. Enkel input-validering
  if (!agreementId || typeof agreementId !== 'string') {
    throw new Error('Invalid agreement id')
  }

  // 🛡 3. Kör finalize (service role används internt endast för storage)
  await finalizeAgreement(agreementId)

  // (Valfritt) här kan vi lägga extra audit om du vill logga actor explicit
}
