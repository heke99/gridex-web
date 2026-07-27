import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function assertIncludes(path, needle, message) {
  assert.ok(read(path).includes(needle), `${path}: ${message}`);
}

function assertNotIncludes(path, needle, message) {
  assert.ok(!read(path).includes(needle), `${path}: ${message}`);
}

const display = read("lib/website/publicContractDisplay.ts");
assert.ok(
  display.includes("hasNumberValue(value)"),
  "publicContractDisplay must use explicit number presence checks",
);
assert.ok(
  display.includes("value === 'number' && Number.isFinite(value)"),
  "publicContractDisplay must preserve real 0 values",
);
assert.ok(
  !/\|\|\s*0/.test(display),
  "publicContractDisplay must not coerce missing values to 0 with || 0",
);

assertIncludes(
  "app/api/admin/agreements/export/route.ts",
  "requireAdminActionAccess",
  "admin agreement export must require admin permissions",
);
assertNotIncludes(
  "app/api/admin/agreements/export/route.ts",
  "from '@/lib/supabase/service'",
  "admin agreement export must not query with unguarded service role",
);
assertIncludes(
  "app/api/admin/agreements/export/route.ts",
  "logPermissionAudit",
  "admin agreement export must write audit",
);

assertIncludes(
  "app/api/legal/accept/route.ts",
  "checkRateLimit",
  "legal accept route must rate limit",
);
assertIncludes(
  "app/api/legal/accept/route.ts",
  "email_sign_token",
  "legal accept route must verify agreement token",
);
assertIncludes(
  "app/api/legal/accept/route.ts",
  "document_hash",
  "legal accept route must hash accepted document",
);
assertIncludes(
  "app/api/legal/accept/route.ts",
  "idempotent",
  "legal accept route must be idempotent",
);

for (const path of [
  "app/api/price/route.ts",
  "app/api/offers/calculate/route.ts",
]) {
  assertIncludes(
    path,
    "status: 410",
    "legacy public price route must be closed",
  );
  assertIncludes(
    path,
    "/elavtal",
    "legacy public price route must point customers to the public contract page",
  );
}

const signup = read("app/(public)/teckna-avtal/page.tsx");
assert.ok(
  signup.includes("validateContractDisplaySnapshot"),
  "submit must validate contract display snapshot",
);
assert.ok(
  signup.includes("offer_reference"),
  "submit must use OPS offer_reference as the binding contract reference",
);
assert.ok(
  signup.includes("Idempotency-Key") ||
    read("lib/ops/client.ts").includes("Idempotency-Key"),
  "customer application writes must use Idempotency-Key header",
);
assert.ok(
  signup.includes("validatePricingPreviewSnapshot"),
  "submit must reject a displayed price that no longer matches the server calculation",
);
assert.ok(
  !signup.includes("loadVerifiedWebsitePricingPreview") && signup.includes("livePreview: signedPreview"),
  "submit must validate the exact signed OPS quote without recalculating it",
);
assert.ok(
  signup.includes("validateCanonicalWebsiteQuote"),
  "submit must verify the signed website pricing quote before writing",
);

const form = read("components/signup/CustomerApplicationForm.tsx");
assert.ok(
  form.includes("pricing_preview_snapshot"),
  "form must post the displayed pricing preview snapshot",
);
assert.ok(
  form.includes("pricing_snapshot_token"),
  "form must post the signed pricing quote token",
);
assert.ok(
  form.includes("contract_display_snapshot"),
  "form must post contract display snapshot",
);
assert.ok(
  form.includes("quoteValid") && form.includes("Prisberäkningen behöver hämtas på nytt"),
  "form must require a price preview before progressing",
);
assert.ok(
  form.includes("legalRequirements.map") && form.includes("legal_acceptance:${requirement.requirement_code}"),
  "form must render OPS-driven legal requirements dynamically",
);
assert.ok(
  form.includes("requirement.public_url") && !form.includes('?? "/fullmakt"'),
  "form must use the exact OPS legal document URL without a local fallback",
);
assert.ok(
  !form.includes("Allmänna villkor: version"),
  "form must not show technical legal version labels to customers",
);
assertIncludes(
  "app/(public)/fullmakt/page.tsx",
  "Fullmakt för anläggningsuppgifter",
  "public power of attorney page must exist",
);

assertIncludes(
  "lib/customerPortal/onboarding.ts",
  "inviteUserByEmail",
  "new customers must receive a Supabase email confirmation/password setup link",
);
assertIncludes(
  "lib/customerPortal/onboarding.ts",
  "return { status: 'profile_linked'",
  "existing customers must be linked and told to log in without sending invite/reset links",
);
assertNotIncludes(
  "lib/customerPortal/onboarding.ts",
  "resetPasswordForEmail",
  "portal onboarding must not send password reset links to existing customers automatically",
);
assertIncludes(
  "lib/customerPortal/onboarding.ts",
  "customer_number",
  "portal onboarding must persist OPS customer number locally",
);
assertIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "ensureCustomerPortalOnboarding",
  "signup submit must link OPS application results to customer portal onboarding",
);
assertIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "non-blocking portal onboarding failed after successful OPS application",
  "portal onboarding must never make a successful OPS application look failed to the customer",
);
assertIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "opsErrorCode",
  "signup submit must map OPS application errors before showing customer-facing messages",
);

assertNotIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "shouldRetryWithFreshIdempotencyKey",
  "the same signed application must not be retried automatically with a fresh idempotency key",
);
assertNotIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "createFreshRetryIdempotencyKey",
  "the same signed application must keep its original idempotency key",
);
assertIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "lockWebsiteSubmissionOpsPayload",
  "the exact OPS request payload must be locked to the idempotency key",
);
assertNotIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "if (error.status === 409) return \"price_changed\"",
  "signup must not map every 409 to a stale price/contract error",
);
assertNotIncludes(
  "lib/customerPortal/onboarding.ts",
  "input.facilityId || input.meteringPointId",
  "portal onboarding must not store a metering point id as facility_id",
);
assertNotIncludes(
  "lib/website/snapshotValidation.ts",
  "canonicalJson(snapshot)",
  "contract display snapshot validation must not be a brittle full-object equality check",
);
assertIncludes(
  "app/(public)/teckna-avtal/tack/SignupThanksPage.tsx",
  "Ny kund: bekräfta din e-post",
  "thank-you page must explain email verification for new customers",
);
assertIncludes(
  "app/(public)/teckna-avtal/tack/SignupThanksPage.tsx",
  "Redan kund? Logga in",
  "thank-you page must tell existing customers to log in",
);
assertNotIncludes(
  "app/(public)/teckna-avtal/tack/SignupThanksPage.tsx",
  "Gå till Mina sidor",
  "thank-you page must not send customers to Mina sidor before password setup",
);
assertIncludes(
  "app/auth/confirm/route.ts",
  "return '/login/reset-password'",
  "invite confirmation must land on the password creation page",
);
assertIncludes(
  "supabase/migrations/20260616_customer_portal_onboarding_links.sql",
  "portal_identity_id",
  "migration must add OPS portal identity link columns",
);

const envExample = read("env.example");
for (const variable of [
  "GRIDEX_API_KEY",
  "GRIDEX_DISABLE_LIVE_SIGNUP",
  "GRIDEX_ENABLE_PORTAL_ONBOARDING",
  "GRIDEX_ENABLE_LEGACY_PORTAL_BUNDLE_COMPATIBILITY",
  "GRIDEX_ENABLE_OPS_WEBHOOKS",
  "GRIDEX_WEBHOOK_SIGNING_SECRET",
  "GRIDEX_OPS_WEBHOOK_TOLERANCE_SECONDS",
  "NEXT_PUBLIC_SITE_URL",
  "CONTRACTS_BUCKET",
  "GRIDEX_WEBSITE_PRICING_QUOTE_SECRET",
]) {
  assert.ok(
    envExample.includes(variable),
    `env.example must document ${variable}`,
  );
}

for (const removedVariable of [
  "GRIDEX_WEBSITE_API_KEY=",
  "GRIDEX_OPS_API_KEY=",
  "GRIDEX_WEBSITE_API_SCOPES",
  "GRIDEX_CUSTOMER_PORTAL_API_SCOPES",
  "GRIDEX_CUSTOMER_PORTAL_REQUIRED_SCOPES",
  "GRIDEX_EXPECTED_TENANT_REFERENCE",
  "GRIDEX_OPS_APPLICATION_QUOTE_REFERENCE_MODE",
  "GRIDEX_OPS_APPLICATION_LEGAL_ACCEPTANCES_MODE",
  "PAPILITE_API_KEY",
  "PAPILITE_BASE_URL",
  "WEBSITE_ARCGIS_GRID_AREAS_QUERY_URL",
]) {
  assert.ok(!envExample.includes(removedVariable), `env.example must not require ${removedVariable}`);
}

const opsClient = read("lib/ops/client.ts");
assertIncludes(
  "lib/ops/client.ts",
  "x-gridex-customer-portal-user-id",
  "customer portal calls must send the explicit OPS auth-link header",
);
assertIncludes(
  "lib/ops/client.ts",
  'const name = "GRIDEX_API_KEY" as const',
  "OPS client must use GRIDEX_API_KEY as the only tenant API key",
);
assertIncludes(
  "lib/ops/client.ts",
  "OPS_API_KEY_FULL_SECRET_NOT_PREFIX",
  "OPS client must reject key_prefix-only API tokens",
);
assertNotIncludes(
  "env.example",
  "eyJhbGciOi",
  "env.example must not contain real JWT-looking secrets",
);
assertIncludes(
  "lib/ops/client.ts",
  "x-gridex-auth-user-id",
  "customer portal calls must send the auth user header",
);
assertIncludes(
  "lib/ops/client.ts",
  "createExternalCustomerId",
  "signup must create a stable external customer id",
);
assertIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "createExternalApplicationId(submissionAttemptId)",
  "signup must keep its local submission id separate from the OPS customer id",
);
assertNotIncludes(
  "lib/ops/client.ts",
  "external_application_id: input.external_application_id",
  "strict OPS application payload must not include undocumented top-level fields",
);
assert.ok(
  !opsClient.includes("identity.externalCustomerId ?? identity.customerNumber"),
  "customer number must not be sent as external customer id",
);
assertNotIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "customer_portal_user_id: linkedAuthUserId",
  "strict customer application payload must not send undocumented portal identity fields",
);
assertIncludes(
  "app/api/v1/customer/portal-bundle/route.ts",
  "overview",
  "web must expose local portal-bundle route",
);
assertIncludes(
  "app/api/v1/customer/events/route.ts",
  "overview.events",
  "web must expose customer events route",
);
assertIncludes(
  "app/api/v1/customer/metering-values/route.ts",
  "overview.meteringValues",
  "web must expose metering values route",
);
assertIncludes(
  "app/api/v1/customer/notifications/read/route.ts",
  "markCustomerNotificationsRead",
  "web must expose notification read route through the server-side portal service",
);
assertIncludes(
  "docs/website-integration.md",
  "Mina sidor identity rules",
  "repo must document the tenant-to-OPS linking contract",
);
assertIncludes(
  "docs/website-integration.md",
  "powerOfAttorney",
  "repo must document the signed power of attorney application payload",
);
assertIncludes(
  "lib/ops/client.ts",
  "accepted: true as const",
  "customer application payload must build the canonical signed powerOfAttorney object",
);
assertIncludes(
  "lib/ops/client.ts",
  "mapApplicationPowerOfAttorney(row.power_of_attorney)",
  "customer application result must use the public power-of-attorney status object",
);
assertNotIncludes(
  "lib/ops/client.ts",
  "power_of_attorney_id: pickString(row",
  "customer application mapper must not read internal power-of-attorney IDs",
);
assertIncludes(
  "lib/ops/client.ts",
  "nextAction",
  "customer application result must expose OPS nextAction",
);
assertNotIncludes(
  "lib/ops/client.ts",
  "manualInformationRequest",
  "customer application result must not depend on removed internal manual-information fields",
);
assertIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  'scope: ["supplier_switch", "facility_information_lookup"]',
  "signup must grant the documented POA scopes",
);
assertIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  'method: "website_acceptance"',
  "signup must send documented POA signing method",
);
assertIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "textVersionId: powerOfAttorneyTextVersionId",
  "signup must send OPS legal_text_versions UUID as powerOfAttorney.textVersionId",
);
assertIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "offer.power_of_attorney_version_id",
  "signup must read POA legal UUID from public-contracts legal.power_of_attorney_version_id",
);
assertIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "isPublicContractReady",
  "signup must use the centralized public-contract validator",
);
assertNotIncludes(
  "lib/website/publicContractDisplay.ts",
  "dynamiska juridikkrav saknas",
  "an empty OPS legal.requirements array is a valid published contract",
);
assertNotIncludes(
  "components/signup/CustomerApplicationForm.tsx",
  `?? "/allmanna-villkor"`,
  "signup must fail closed instead of substituting local documents for OPS legal URLs",
);
assertIncludes(
  "lib/website/publicContractDisplay.ts",
  "terms_version_id: contract.terms_version_id",
  "contract snapshot must include terms legal UUID",
);
assertIncludes(
  "lib/website/publicContractDisplay.ts",
  "price_terms_url: contract.price_terms_url",
  "contract snapshot must include OPS price terms URL",
);
assertIncludes(
  "app/(public)/teckna-avtal/page.tsx",
  "nextActionMessage",
  "signup thank-you redirect must preserve customer-safe nextAction message",
);
assertIncludes(
  "app/(public)/teckna-avtal/tack/SignupThanksPage.tsx",
  "nextActionMessage",
  "thank-you page must surface customer-safe OPS nextAction message",
);
assertIncludes(
  "app/api/v1/customer/profile-update/route.ts",
  "submitOpsCustomerProfileUpdate",
  "web must expose the documented profile-update route",
);
assertIncludes(
  "app/api/v1/customer/move-out/route.ts",
  "submitOpsCustomerMoveOut",
  "web must expose the documented move-out route",
);

console.log("Launch-readiness checks passed");

assertNotIncludes(
  "components/ElectricityCalculator.tsx",
  "En offert gäller i 15 minuter",
  "calculator copy must not say offert is valid for 15 minutes",
);
assertIncludes(
  "components/ElectricityCalculator.tsx",
  "prisberäkning",
  "calculator must use price calculation wording",
);
assertIncludes(
  "lib/ops/client.ts",
  "total_monthly_cost_incl_vat_sek",
  "OPS mapper must support total incl VAT aliases",
);
assertIncludes(
  "lib/website/snapshotValidation.ts",
  "total_monthly_cost_incl_vat_sek",
  "snapshot validation must support total incl VAT aliases",
);
assert.equal(
  existsSync(new URL("../lib/website/pricingPreview.ts", import.meta.url)),
  false,
  "the competing local pricing engine must be removed",
);
for (const removedPath of [
  "../lib/website/marketPriceService.ts",
  "../lib/website/componentCalculator.ts",
  "../lib/website/priceAreaResolver.ts",
  "../lib/website/embeddedAreaPricing.ts",
  "../lib/website/pricingFallbackPolicy.ts",
]) {
  assert.equal(existsSync(new URL(removedPath, import.meta.url)), false, `${removedPath} must be removed from checkout`);
}
for (const path of [
  "app/api/v1/website/quote/route.ts",
  "app/api/v1/website/pricing/verify/route.ts",
]) {
  assertIncludes(
    path,
    "export const dynamic = 'force-dynamic'",
    "Next.js route config must be declared locally for static analysis",
  );
  assertIncludes(
    path,
    "export const runtime = 'nodejs'",
    "Next.js runtime config must be declared locally for static analysis",
  );
  assertNotIncludes(
    path,
    "export { dynamic",
    "Next.js route config must not be re-exported",
  );
  assertNotIncludes(
    path,
    "runtime } from",
    "Next.js runtime config must not be re-exported",
  );
}
assertIncludes(
  "app/api/v1/website/pricing/preview/route.ts",
  "fetchOpsWebsiteQuote",
  "offer pricing must use the canonical OPS quote endpoint",
);
assertIncludes(
  "app/admin/monthly-spot/page.tsx",
  "Förväntad publik period",
  "monthly spot admin must show expected public period",
);
assertIncludes(
  "app/admin/monthly-spot/page.tsx",
  "Publik kalkylator använder alltid föregående kalendermånad",
  "monthly spot admin must explain public period rule",
);
assertIncludes(
  "components/PriceResultCard.tsx",
  "Fast månadspris",
  "price result card must label fixed monthly products",
);
assertIncludes(
  "components/PriceResultCard.tsx",
  "Bindande offert",
  "price result card must display quote binding status",
);
assertNotIncludes(
  "components/PriceResultCard.tsx",
  "Elprisetjustnu",
  "offer price card must not hardcode a local spot provider",
);
