import PDFDocument from 'pdfkit'
import { supabaseService } from '@/lib/supabase/service'
import { ContractAgreement } from '@/lib/types/contracts'

function formatDate(value?: string | null) {
  if (!value) return '—'

  try {
    return new Date(value).toLocaleString('sv-SE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return value
  }
}

function buildCustomerName(agreement: ContractAgreement) {
  const fullName = `${agreement.first_name ?? ''} ${agreement.last_name ?? ''}`.trim()
  return fullName || agreement.customer_name || '—'
}

function buildAddress(agreement: ContractAgreement) {
  const parts = [
    agreement.address ?? agreement.street ?? null,
    agreement.apartment ?? null,
    agreement.postal_code ?? null,
    agreement.city ?? null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : '—'
}

function getSignedAt(agreement: ContractAgreement) {
  return agreement.bankid_completed_at ?? agreement.email_signed_at ?? null
}

export async function generateContractPDF(
  agreement: ContractAgreement
): Promise<string> {
  const bucket = process.env.CONTRACTS_BUCKET || 'contract-docs'
  const fileName = `${agreement.id}.pdf`

  const customerName = buildCustomerName(agreement)
  const address = buildAddress(agreement)
  const signedAt = getSignedAt(agreement)

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
    })

    const buffers: Buffer[] = []

    doc.on('data', (chunk: Buffer) => buffers.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)

    doc.fontSize(18).text('GRIDEX AB', { align: 'center' })
    doc.moveDown()

    doc.fontSize(14).text('Avtalsunderlag', { underline: true })
    doc.moveDown()

    doc.fontSize(11).text(`Avtals-ID: ${agreement.id}`)
    doc.text(`Avtalsreferens: ${agreement.agreement_reference ?? '—'}`)
    doc.text(`Kundnummer: ${agreement.customer_number ?? '—'}`)
    doc.text(`Avtal/slug: ${agreement.contract_slug ?? '—'}`)
    doc.moveDown()

    doc.fontSize(13).text('Kunduppgifter', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(11).text(`Namn: ${customerName}`)
    doc.text(`E-post: ${agreement.email ?? '—'}`)
    doc.text(`Telefon: ${agreement.phone ?? '—'}`)
    doc.text(`Personnummer: ${agreement.personal_number ?? '—'}`)
    doc.text(`Adress: ${address}`)
    doc.text(`Anläggnings-ID: ${agreement.facility_id ?? '—'}`)
    doc.moveDown()

    doc.fontSize(13).text('Signering & status', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(11).text(`Signeringsmetod: ${agreement.sign_method ?? '—'}`)
    doc.text(`Signerad: ${formatDate(signedAt)}`)
    doc.text(`Aktiverad: ${formatDate(agreement.activated_at)}`)
    doc.text(`Status: ${agreement.status ?? '—'}`)
    doc.text(`Skapad: ${formatDate(agreement.created_at)}`)
    doc.moveDown()

    doc.fontSize(13).text('Övrigt', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(11).text(`Pricing version ID: ${agreement.pricing_version_id ?? '—'}`)
    doc.text(`Move-in date: ${agreement.move_in_date ?? '—'}`)
    doc.text(`BankID order ref: ${agreement.bankid_order_ref ?? '—'}`)

    doc.moveDown(2)
    doc.fontSize(10).fillColor('gray').text(
      'Detta dokument är genererat elektroniskt av Gridex system.',
      { align: 'left' }
    )

    doc.end()
  })

  const { error } = await supabaseService.storage
    .from(bucket)
    .upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (error) {
    throw new Error(`[generateContractPDF] Upload failed: ${error.message}`)
  }

  return fileName
}