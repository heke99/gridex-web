'use server'

import { finalizeAgreement } from '@/lib/contracts/finalizeAgreement'
import { requireGlobalAdminActionAccess } from '@/lib/admin/guards'
import { revalidatePath } from 'next/cache'

export async function finalizeAgreementAction(
  agreementId: string
): Promise<void> {
  // Legacy agreements are a global directory; the finalizer uses service_role.
  const { userId } = await requireGlobalAdminActionAccess({ allOf: ['agreements.write'] })

  // 🔎 2. Enkel input-validering
  if (!agreementId || typeof agreementId !== 'string') {
    throw new Error('Invalid agreement id')
  }

  // Authorize before the privileged PDF and agreement mutation.
  await finalizeAgreement(agreementId, userId)
  revalidatePath(`/admin/agreements/${agreementId}`)
  revalidatePath('/admin/agreements')
  revalidatePath('/admin/customers')
}
