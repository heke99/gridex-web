'use server'

/** New agreements and verified account onboarding belong to the canonical OPS checkout. */
export async function createAgreementAction(formData: FormData): Promise<never> {
  void formData
  throw new Error('Den äldre avtalsskaparen är avvecklad. Använd det aktuella teckningsflödet.')
}
