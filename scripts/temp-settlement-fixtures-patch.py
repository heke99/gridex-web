from pathlib import Path

path = Path('tests/website-api.contract.test.mjs')
text = path.read_text()
anchor = """const baseApplicationInput = {
  external_customer_id: 'tenant-customer-identity-test',
  offer_reference: 'offer_test',
  quote_reference: 'quote_test',
  price_option_reference: 'price_option_test',
"""
replacement = """const baseApplicationInput = {
  external_customer_id: 'tenant-customer-identity-test',
  offer_reference: 'offer_test',
  quote_reference: 'quote_test',
  settlement: {
    model: 'market_monthly',
    customer_accepts: 'pricing_model',
    energy_price_locked_at_signup: false,
    uses_actual_metered_consumption: true,
    market_data_role: 'indicative_preview_only',
    settlement_resolution: 'month',
  },
  price_option_reference: 'price_option_test',
"""
if replacement not in text:
    if anchor not in text:
        raise SystemExit('baseApplicationInput settlement anchor missing')
    text = text.replace(anchor, replacement, 1)
path.write_text(text)
