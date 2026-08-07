import fs from 'node:fs'
import path from 'node:path'

function replaceKnownPattern(file, before, after, description) {
  const filePath = path.resolve(file)
  const source = fs.readFileSync(filePath, 'utf8')
  if (source.includes(after)) {
    console.log(`${description}: already applied.`)
    return
  }
  if (!source.includes(before)) {
    throw new Error(`${description}: expected source pattern not found; refusing a blind rewrite.`)
  }
  fs.writeFileSync(filePath, source.replace(before, after))
  console.log(`${description}: applied.`)
}

replaceKnownPattern(
  'lib/website/publicContractContract.ts',
  `    modules.flatMap((item) => {\n      const module = record(item)\n      const id = module ? text(module.id) : null\n      return id && module ? [[id, module] as const] : []\n    }),`,
  `    modules.flatMap((item) => {\n      const legalDocument = record(item)\n      const id = legalDocument ? text(legalDocument.id) : null\n      return id && legalDocument ? [[id, legalDocument] as const] : []\n    }),`,
  'Next.js reserved module binding remediation',
)

replaceKnownPattern(
  'lib/website/canonicalQuoteValidation.ts',
  `    selected_component_references: effectiveQuote.selected_component_references,\n    site_count: effectiveQuote.site_count,\n  })`,
  `    selected_component_references: effectiveQuote.selected_component_references,\n    site_count: effectiveQuote.site_count,\n    price_area: area.price_area_code,\n    grid_area_code: area.grid_area_code,\n    postal_code: input.location.postalCode,\n  })`,
  'Canonical quote validation area context remediation',
)
