//lib/contracts/pdf.ts
import PDFDocument from 'pdfkit'
import { supabaseService } from '@/lib/supabase/service'
import { ContractAgreement } from '@/lib/types/contracts'

export async function generateContractPDF(
  agreement: ContractAgreement
): Promise<string> {
  const bucket = process.env.CONTRACTS_BUCKET || 'contract-docs'
  const fileName = `${agreement.id}.pdf`

  const doc = new PDFDocument()
  const buffers: Buffer[] = []

  doc.on('data', buffers.push.bind(buffers))
  doc.on('end', async () => {
    const pdfData = Buffer.concat(buffers)

    await supabaseService.storage
      .from(bucket)
      .upload(fileName, pdfData, {
        contentType: 'application/pdf',
        upsert: true,
      })
  })

  doc.fontSize(18).text('GRIDEX AB', { align: 'center' })
  doc.moveDown()
  doc.fontSize(12).text(`Kund: ${agreement.customer_name}`)
  doc.text(`Personnummer: ${agreement.personal_number}`)
  doc.text(`Adress: ${agreement.address}`)
  doc.text(`Avtal: ${agreement.contract_type}`)
  doc.text(`Startdatum: ${agreement.start_date}`)
  doc.text(`Signerad: ${agreement.email_signed_at ?? agreement.bankid_signed_at}`)
  doc.end()

  return fileName
}