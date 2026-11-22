export function invoiceContactErrors(fields: {
  invoice_email: string
  billing_street: string
  billing_postal_code: string
  billing_city: string
  billing_country: string
}, separateEmail: boolean, separateAddress: boolean): Record<string, string> {
  const errors: Record<string, string> = {}
  if (separateEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.invoice_email.trim())) {
    errors.invoice_email = 'Ange en giltig faktura-e-postadress.'
  }
  if (separateAddress) {
    if (!fields.billing_street.trim()) errors.billing_street = 'Ange fakturans gatuadress.'
    if (!/^\d{5}$/.test(fields.billing_postal_code.replace(/\s/g, ''))) errors.billing_postal_code = 'Ange ett fakturapostnummer med fem siffror.'
    if (!fields.billing_city.trim()) errors.billing_city = 'Ange fakturaorten.'
    if (!/^[a-z]{2}$/i.test(fields.billing_country.trim())) errors.billing_country = 'Ange en landkod med två bokstäver.'
  }
  return errors
}
