export type PasswordPolicyResult = {
  length: boolean
  uppercase: boolean
  number: boolean
  special: boolean
  score: number
  valid: boolean
}

export function passwordPolicy(password: string): PasswordPolicyResult {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-ZÅÄÖ]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-zÅÄÖåäö0-9]/.test(password),
  }
  const score = Object.values(requirements).filter(Boolean).length
  return { ...requirements, score, valid: score === 4 }
}

export function passwordStrength(password: string): number {
  return passwordPolicy(password).score
}

export function passwordMeetsPolicy(password: string): boolean {
  return passwordPolicy(password).valid
}

export const PASSWORD_REQUIREMENT_TEXT =
  'Minst 8 tecken, versal, siffra och specialtecken.'
