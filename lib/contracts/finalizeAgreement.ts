/** Legacy finalization is retired: only OPS can sign and finalize customer agreements. */
export async function finalizeAgreement(agreementId: string): Promise<void> {
  if (!agreementId) throw new Error('Avtalsreferens saknas.')
  throw new Error('Den äldre slutbehandlingen är avstängd. Hantera avtal och bekräftelse i Gridex OPS.')
}
