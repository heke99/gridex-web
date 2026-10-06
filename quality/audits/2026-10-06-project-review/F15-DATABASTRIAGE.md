# F15 – avgränsad databastriage

Underlag: katalog/advisors från 2026-10-06. Detta är en objekttriage, inte en ändring av den delade OPS-databasens rollmodell.

| Tabell | Varningsinstanser för permissiva policyer | Åtgärd |
|---|---:|---|
| audit_logs | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| billing_export_runs | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| billing_underlays | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| communication_routes | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| companies | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| company_invitations | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| company_memberships | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| contract_agreements | 20 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| contract_area_pricing | 16 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| contract_pricing_versions | 13 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| contract_products | 2 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| customer_authorization_documents | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| customer_blockers | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| customer_contacts | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| customer_contracts | 15 | Kundskrivgrants återkallas i F01; SELECT/policy-prestanda ska verifieras i målklonen. |
| customer_documents | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| customer_internal_notes | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| customer_invoices | 5 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| customer_sites | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| customer_support_messages | 10 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| customer_support_tickets | 10 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| customers | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| ediel_actor_settings | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| ediel_message_events | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| ediel_messages | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| ediel_route_profiles | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| external_provider_catalog | 5 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| external_system_connections | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| grid_owner_data_requests | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| gridex_monthly_spot_prices | 8 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| gridex_portfolio_area_pricing | 5 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| gridex_postal_code_price_area | 5 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| gridex_rate_limits | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| gridex_spot_admin_basis | 5 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| gridex_spot_area_settings | 5 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| gridex_spot_basis_config | 2 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| integration_sync_jobs | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| legal_documents | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| metering_points | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| monthly_spot_prices | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| municipality_price_areas | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| outbound_dispatch_events | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| outbound_requests | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| partner_exports | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| portfolio_area_pricing | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| postal_code_price_area | 5 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| postal_codes | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| postal_price_areas | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| powers_of_attorney | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| pricing_settings | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| pricing_version_audit | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| spot_contract_settings | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| spot_prices_daily | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| supplier_switch_events | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| supplier_switch_requests | 15 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| user_permissions | 1 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |
| user_profiles | 2 | Delad OPS-/adminmodell: kvar för rollmatris och frågeplaner i staging. |

Varningarna avser roll/operation-kombinationer och kan inkludera roller som saknar table grants. Flera permissiva policyer innebär OR-semantik; en konsolidering måste bevara uttryckens NULL-/roll-/auth.uid()-beteende. En varning bevisar inte att en kund kan läsa en annan kund.

Den nya indexmigrationen kontrollerar strukturell likhet före DROP, bevarar constraintindex och skapar tio Web-relevanta FK-index samt index för nya pris-auditkolumner. Alla övriga 194 nollanvända index behålls tills representativ mätperiod och beroenden visar att de kan tas bort. Återstående FK bedöms per verklig accessväg; ett index på varje FK är inte alltid kostnadseffektivt.

Godkännandekriterier för nästa steg: fast rollmatris (anon, kund A/B, staff per organisation, admin, service), samma tillåtna/nekade operationer före/efter, EXPLAIN med representativ tenant/datamängd och dokumenterad skrivkostnad. Ta inga breda DDL-beslut bara från varningsantal.

## Genomförd fortsatt triage

En ny katalogläsning fann 54 exakt likadana permissiva policyer på 19 tabeller. Migrering 20261006214901 jämför kommando, roll-OID-lista och båda villkor mot aktuell katalog före varje DROP; avvikelse eller restriktiv policy innebär att inget tas bort. Testet använder de observerade dubblettuttrycken med syntetiska auth-/organisationsfunktioner, två kunder, läs-/skrivpersonal, admin, anon och service. Samtliga 665 provade utfall för läsning, insättning och uppdatering är lika före/efter och efter omkörning. Det intygar dubblettrensningen, inte hela skarpa OPS-rollmodellen. Övriga olika policyer/index ändras inte bara för att en rådgivare varnar.
