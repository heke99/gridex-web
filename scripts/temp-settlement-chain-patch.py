from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"{label} anchor missing in {path}")
    file.write_text(text.replace(old, new, 1))


types = Path("lib/ops/client/types.ts")
text = types.read_text()
dto_anchor = "export type OpsCustomerApplicationRequestDto = WebsiteApiComponents['schemas']['CustomerApplicationRequest'];\n"
if "export type OpsWebsiteQuoteSettlement" not in text:
    if dto_anchor not in text:
        raise SystemExit("CustomerApplicationRequest DTO anchor missing")
    text = text.replace(
        dto_anchor,
        dto_anchor + "export type OpsWebsiteQuoteSettlement = WebsiteApiComponents['schemas']['WebsiteQuoteSettlement'];\n",
        1,
    )
input_anchor = "  quote_reference: string;\n  price_option_reference: string;\n"
input_new = "  quote_reference: string;\n  settlement: OpsWebsiteQuoteSettlement;\n  price_option_reference: string;\n"
if input_new not in text:
    if input_anchor not in text:
        raise SystemExit("OpsCustomerApplicationInput quote anchor missing")
    text = text.replace(input_anchor, input_new, 1)
preview_anchor = "  is_binding?: boolean;\n  assumptions?: OpsQuoteAssumption[];\n"
preview_new = "  is_binding?: boolean;\n  settlement: OpsWebsiteQuoteSettlement;\n  assumptions?: OpsQuoteAssumption[];\n"
if preview_new not in text:
    if preview_anchor not in text:
        raise SystemExit("OpsWebsitePricingPreview settlement anchor missing")
    text = text.replace(preview_anchor, preview_new, 1)
types.write_text(text)

replace_once(
    "lib/ops/client/application.ts",
    "    quote_reference: quoteReference!,\n    price_option_reference: priceOptionReference!,\n",
    "    quote_reference: quoteReference!,\n    settlement: input.settlement,\n    price_option_reference: priceOptionReference!,\n",
    "application payload settlement",
)

public_api = Path("lib/website/publicApi.ts")
text = public_api.read_text()
import_anchor = "import type { PublicEnergyDirection, PublicProductionPricing } from '@/lib/website/publicContractContract'\n"
generated_import = "import type { components as WebsiteApiComponents } from '@/lib/ops/generated/website-api'\n"
if generated_import not in text:
    if import_anchor not in text:
        raise SystemExit("publicApi import anchor missing")
    text = text.replace(import_anchor, import_anchor + generated_import, 1)
alias_anchor = 'export type WebsiteInvoiceDeliveryMethod = "email" | "e_invoice" | "paper" | "direct_debit";\n'
alias = "export type WebsiteQuoteSettlement = WebsiteApiComponents['schemas']['WebsiteQuoteSettlement'];\n"
if alias not in text:
    if alias_anchor not in text:
        raise SystemExit("publicApi settlement alias anchor missing")
    text = text.replace(alias_anchor, alias_anchor + alias, 1)
preview_anchor = "  is_binding?: boolean;\n  assumptions?: WebsiteQuoteAssumption[];\n"
preview_new = "  is_binding?: boolean;\n  settlement: WebsiteQuoteSettlement;\n  assumptions?: WebsiteQuoteAssumption[];\n"
if preview_new not in text:
    if preview_anchor not in text:
        raise SystemExit("WebsitePricingPreview settlement anchor missing")
    text = text.replace(preview_anchor, preview_new, 1)
public_api.write_text(text)

core = Path("lib/ops/client/core.ts")
text = core.read_text()
import_old = "OpsWebsitePriceArea, OpsWebsiteQuoteInput, OpsInvoiceDeliveryMethod, OpsQuoteAssumption"
import_new = "OpsWebsitePriceArea, OpsWebsiteQuoteInput, OpsInvoiceDeliveryMethod, OpsWebsiteQuoteSettlement, OpsQuoteAssumption"
if import_new not in text:
    if import_old not in text:
        raise SystemExit("core settlement type import anchor missing")
    text = text.replace(import_old, import_new, 1)
site_anchor = "  const siteCount = normalizeInteger(row.site_count);\n"
settlement_decl = "  const settlement = recordValue(row.settlement) as OpsWebsiteQuoteSettlement | null;\n"
if settlement_decl not in text:
    if site_anchor not in text:
        raise SystemExit("core site_count anchor missing")
    text = text.replace(site_anchor, site_anchor + settlement_decl, 1)
required_anchor = "    !normalizedInvoiceDeliveryMethod ||\n    !resolutionId ||\n"
required_new = "    !normalizedInvoiceDeliveryMethod ||\n    !settlement ||\n    !resolutionId ||\n"
if required_new not in text:
    if required_anchor not in text:
        raise SystemExit("core quote required settlement anchor missing")
    text = text.replace(required_anchor, required_new, 1)
return_anchor = "    is_binding: pickBoolean(row, ['is_binding', 'isBinding']) ?? false,\n    assumptions: normalizeQuoteAssumptions(row.assumptions),\n"
return_new = "    is_binding: pickBoolean(row, ['is_binding', 'isBinding']) ?? false,\n    settlement,\n    assumptions: normalizeQuoteAssumptions(row.assumptions),\n"
if return_new not in text:
    if return_anchor not in text:
        raise SystemExit("core quote settlement return anchor missing")
    text = text.replace(return_anchor, return_new, 1)
core.write_text(text)

quote = Path("lib/website/pricingQuote.ts")
text = quote.read_text()
import_anchor = '  WebsiteQuoteMarketReference,\n} from "@/lib/website/publicApi";\n'
import_new = '  WebsiteQuoteMarketReference,\n  WebsiteQuoteSettlement,\n} from "@/lib/website/publicApi";\n'
if import_new not in text:
    if import_anchor not in text:
        raise SystemExit("pricingQuote settlement import anchor missing")
    text = text.replace(import_anchor, import_new, 1)
type_anchor = "  is_binding: boolean;\n  assumptions: WebsiteQuoteAssumption[];\n"
type_new = "  is_binding: boolean;\n  settlement: WebsiteQuoteSettlement;\n  assumptions: WebsiteQuoteAssumption[];\n"
if type_new not in text:
    if type_anchor not in text:
        raise SystemExit("WebsitePricingQuote settlement type anchor missing")
    text = text.replace(type_anchor, type_new, 1)
helper_anchor = 'function validReferences(value: unknown): value is string[] {\n  return Array.isArray(value) && value.length <= 100 &&\n    value.every((item) => typeof item === "string" && /^[a-z0-9][a-z0-9_-]{2,159}$/i.test(item)) &&\n    new Set(value).size === value.length;\n}\n'
helper = helper_anchor + '\nfunction validSettlement(value: unknown): value is WebsiteQuoteSettlement {\n  if (!value || typeof value !== "object" || Array.isArray(value)) return false;\n  const row = value as Record<string, unknown>;\n  return ["fixed_price", "market_monthly", "market_hourly", "market_quarter_hour", "portfolio", "mixed"].includes(String(row.model ?? "")) &&\n    ["fixed_energy_price", "pricing_model", "portfolio_pricing_model", "mixed_pricing_model"].includes(String(row.customer_accepts ?? "")) &&\n    typeof row.energy_price_locked_at_signup === "boolean" &&\n    row.uses_actual_metered_consumption === true &&\n    ["not_applicable", "indicative_preview_only"].includes(String(row.market_data_role ?? "")) &&\n    ["fixed", "month", "hour", "quarter_hour", "portfolio_period", "mixed_components"].includes(String(row.settlement_resolution ?? ""));\n}\n'
if "function validSettlement(value: unknown)" not in text:
    if helper_anchor not in text:
        raise SystemExit("pricingQuote settlement validator anchor missing")
    text = text.replace(helper_anchor, helper, 1)
is_quote_anchor = '    finite(q.price_per_kwh_ore) && finite(q.total_monthly_cost_sek) && finite(q.total_monthly_cost_incl_vat_sek) &&\n    text(q.pricing_interval) && text(q.estimate_method) && typeof q.is_binding === "boolean" &&\n    Array.isArray(q.assumptions) && Array.isArray(q.market_sources) && text(q.pricing_snapshot_schema_version);\n'
is_quote_new = '    finite(q.price_per_kwh_ore) && finite(q.total_monthly_cost_sek) && finite(q.total_monthly_cost_incl_vat_sek) &&\n    text(q.pricing_interval) && text(q.estimate_method) && typeof q.is_binding === "boolean" && validSettlement(q.settlement) &&\n    Array.isArray(q.assumptions) && Array.isArray(q.market_sources) && text(q.pricing_snapshot_schema_version);\n'
if is_quote_new not in text:
    if is_quote_anchor not in text:
        raise SystemExit("pricingQuote isQuote settlement anchor missing")
    text = text.replace(is_quote_anchor, is_quote_new, 1)
required_anchor = '    input.preview.pricing_interval && input.preview.estimate_method && input.preview.pricing_snapshot_schema_version &&\n    typeof input.preview.is_binding === "boolean" && Number.isFinite(validUntilTimestamp);\n'
required_new = '    input.preview.pricing_interval && input.preview.estimate_method && input.preview.pricing_snapshot_schema_version &&\n    typeof input.preview.is_binding === "boolean" && validSettlement(input.preview.settlement) && Number.isFinite(validUntilTimestamp);\n'
if required_new not in text:
    if required_anchor not in text:
        raise SystemExit("pricingQuote issue settlement anchor missing")
    text = text.replace(required_anchor, required_new, 1)
assign_anchor = "    is_binding: input.preview.is_binding as boolean,\n    assumptions: input.preview.assumptions ?? [],\n"
assign_new = "    is_binding: input.preview.is_binding as boolean,\n    settlement: { ...input.preview.settlement },\n    assumptions: input.preview.assumptions ?? [],\n"
if assign_new not in text:
    if assign_anchor not in text:
        raise SystemExit("pricingQuote settlement assignment anchor missing")
    text = text.replace(assign_anchor, assign_new, 1)
preview_anchor = "    is_binding: quote.is_binding,\n    assumptions: quote.assumptions,\n"
preview_new = "    is_binding: quote.is_binding,\n    settlement: { ...quote.settlement },\n    assumptions: quote.assumptions,\n"
if preview_new not in text:
    if preview_anchor not in text:
        raise SystemExit("quoteToWebsitePricingPreview settlement anchor missing")
    text = text.replace(preview_anchor, preview_new, 1)
quote.write_text(text)

page = Path("app/(public)/teckna-avtal/page.tsx")
text = page.read_text()
page_anchor = "      quote_reference: verifiedQuote.value.quote.ops_quote_reference,\n      price_option_reference: verifiedQuote.value.quote.price_option_reference,\n"
page_new = "      quote_reference: verifiedQuote.value.quote.ops_quote_reference,\n      settlement: verifiedQuote.value.quote.settlement,\n      price_option_reference: verifiedQuote.value.quote.price_option_reference,\n"
if page_new not in text:
    if page_anchor not in text:
        raise SystemExit("checkout settlement callsite anchor missing")
    text = text.replace(page_anchor, page_new, 1)
page.write_text(text)

test = Path("tests/website-api.contract.test.mjs")
text = test.read_text()
application_loop = "for (const field of ['price_option_reference', 'invoice_delivery_method', 'selected_component_references', 'site_count']) assert.ok(applicationSchema.required.includes(field), `customer application field must be required: ${field}`)"
application_loop_new = "for (const field of ['settlement', 'price_option_reference', 'invoice_delivery_method', 'selected_component_references', 'site_count']) assert.ok(applicationSchema.required.includes(field), `customer application field must be required: ${field}`)"
if application_loop_new not in text:
    if application_loop not in text:
        raise SystemExit("customer application required-field loop anchor missing")
    text = text.replace(application_loop, application_loop_new, 1)
fixture_anchor = "  quote_reference: 'quote_test',\n  price_option_reference: 'price_option_test',\n"
fixture_new = (
    "  quote_reference: 'quote_test',\n"
    "  settlement: {\n"
    "    model: 'market_monthly',\n"
    "    customer_accepts: 'pricing_model',\n"
    "    energy_price_locked_at_signup: false,\n"
    "    uses_actual_metered_consumption: true,\n"
    "    market_data_role: 'indicative_preview_only',\n"
    "    settlement_resolution: 'month',\n"
    "  },\n"
    "  price_option_reference: 'price_option_test',\n"
)
if "  quote_reference: 'quote_test',\n  settlement: {\n" not in text:
    if fixture_anchor not in text:
        raise SystemExit("website API application fixture quote anchor missing")
    text = text.replace(fixture_anchor, fixture_new, 1)
test.write_text(text)
