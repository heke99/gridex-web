export function isContactPhone(value: string): boolean {
  const phone = value.trim()
  return phone.length <= 32 && /^\+?[0-9]{5,20}$/.test(phone.replace(/[\s.\-/()]/g, ''))
}
