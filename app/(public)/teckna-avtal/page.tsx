import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import SignupFlowClient from "@/components/signup/SignupFlowClient";
import FaqJsonLd from "@/components/seo/FaqJsonLd";
import FaqList from "@/components/faq/FaqList";
import {
  type SignupContractOption,
  type SignupSubmissionState,
} from "@/components/signup/CustomerApplicationForm";
import {
  buildOpsCustomerApplicationPayload,
  createExternalApplicationId,
  createExternalCustomerId,
  fetchOpsPublicContracts,
  fetchOpsPublicContractsFresh,
  getOpsClientStatus,
  hashIp,
  isOpsError,
  isTransientOpsError,
  submitOpsCustomerApplication,
  submitOpsCustomerPortalSync,
  type OpsCustomerApplicationInput,
  type OpsPublicContract,
} from "@/lib/ops/client";
import { checkRateLimit } from "@/lib/security/rateLimit";

import {
  validateContractDisplaySnapshot,
  validatePricingPreviewSnapshot,
} from "@/lib/website/snapshotValidation";
import {
  quoteToWebsitePricingPreview,
  validateWebsitePricingQuote,
} from "@/lib/website/pricingQuote";
import {
  lockWebsiteSubmissionOpsPayload,
  prepareWebsiteSubmission,
  submissionPayloadHash,
  updateWebsiteSubmission,
} from "@/lib/website/submissionStore";
import { ensureCustomerPortalOnboarding } from "@/lib/customerPortal/onboarding";
import { enqueuePortalWrite } from "@/lib/customerPortal/outbox";
import { contractSupportsCustomerType } from "@/lib/website/customerType";
import { createWebsiteApplicationResult } from "@/lib/website/applicationResultStore";
import { readWebsiteCheckoutContext } from "@/lib/website/checkoutContextStore";
import { buildPublicContractDisplay } from "@/lib/website/publicContractDisplay";
import { sanitizePricingComponentsBeforeAreaResolution } from "@/lib/website/publicPricingVisibility";
import { validateCanonicalWebsiteQuote } from "@/lib/website/canonicalQuoteValidation";
import {
  digitsOnly,
  isValidRequestedStartDate,
  isValidSwedishOrganizationNumber,
  isValidSwedishPersonalNumber,
  normalizePhoneToE164,
} from "@/lib/website/signupValidation";
import { checkoutFaqItems } from "@/lib/content/faq";
import {
  consumptionProfileMatchesMonthlyKwh,
  normalizeWebsiteConsumptionProfile,
} from "@/lib/website/consumptionEstimator";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teckna elavtal – Gridex",
  description:
    "Teckna elavtal hos Gridex. Välj avtal, granska pris och avgifter, godkänn villkor och få bekräftelse på nästa steg.",
  alternates: { canonical: "https://gridex.se/teckna-avtal" },
};

type PageParams = {
  offer?: string;
  checkout?: string;
  error?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

function normalizeText(value: FormDataEntryValue | null): string {
  return String(value || "").trim();
}

function normalizeEmail(value: FormDataEntryValue | null): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getClientIpFromHeaders(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const xrip = h.get("x-real-ip");
  if (xrip) return xrip.trim();

  return null;
}

function toSignupContractOption(item: OpsPublicContract): SignupContractOption {
  return {
    name: item.name,
    value: item.offer_reference,
    offerReference: item.offer_reference,
    productCode: item.product_code ?? null,
    type: item.type,
    monthlyFeeSek: item.monthly_fee_sek,
    invoiceFeeSek: null,
    markupOrePerKwh: item.markup_ore_per_kwh,
    variableMarkupOrePerKwh: item.variable_markup_ore_per_kwh,
    fixedPriceOrePerKwh: item.type === "fixed" ? null : item.fixed_price_ore_per_kwh,
    monthlyFixedPriceSek: item.monthly_fixed_price_sek ?? null,
    elcertOrePerKwh: item.elcert_ore_per_kwh ?? null,
    portfolioPriceOrePerKwh: null,
    vatRate: item.vat_rate ?? null,
    pricingModel: item.pricing_model ?? null,
    spotShare: item.spot_share ?? null,
    portfolioShare: item.portfolio_share ?? null,
    pricingVisibility: item.pricing_visibility ?? {},
    pricingComponents: sanitizePricingComponentsBeforeAreaResolution(item.pricing_components, item.type)
      .filter((component) => component.website_card_visible),
    validFrom: item.valid_from ?? null,
    validTo: item.valid_to ?? null,
    bindingPeriodMonths: item.binding_period_months ?? null,
    noticePeriodDays: item.notice_period_days ?? null,
    noticePeriodMonths: item.notice_period_months ?? null,
    automaticRenewal: item.automatic_renewal ?? null,
    included: item.included ?? null,
    excluded: item.excluded ?? null,
    startInfo: item.start_info ?? null,
    customerTypes: item.customer_types ?? null,
    termsVersion: item.terms_version ?? null,
    termsVersionId: item.terms_version_id ?? null,
    termsUrl: item.terms_url ?? null,
    privacyPolicyVersion: item.privacy_policy_version ?? null,
    privacyPolicyVersionId: item.privacy_policy_version_id ?? null,
    privacyPolicyUrl: item.privacy_policy_url ?? null,
    cancellationRightVersion: item.cancellation_right_version ?? null,
    withdrawalVersionId: item.withdrawal_version_id ?? null,
    withdrawalUrl: item.withdrawal_url ?? null,
    powerOfAttorneyVersion: item.power_of_attorney_version ?? null,
    powerOfAttorneyVersionId: item.power_of_attorney_version_id ?? null,
    powerOfAttorneyUrl: item.power_of_attorney_url ?? null,
    powerOfAttorneyRequired: item.power_of_attorney_required ?? false,
    priceTermsVersion: item.price_terms_version ?? null,
    priceTermsVersionId: item.price_terms_version_id ?? null,
    priceTermsUrl: item.price_terms_url ?? null,
    legalRequirements: item.legal_requirements ?? [],
  };
}

function selectedContractFromParams(
  contracts: OpsPublicContract[],
  params: PageParams,
): OpsPublicContract | null {
  const offerReference = params.offer?.trim();
  if (!offerReference) return contracts[0] ?? null;
  return (
    contracts.find((contract) => contract.offer_reference === offerReference) ??
    null
  );
}

function isSignupReadyContract(offer: OpsPublicContract): boolean {
  if (!buildPublicContractDisplay(offer).ready) return false;
  const requirements = offer.legal_requirements ?? [];
  if (!requirements.length) return false;
  return requirements.every((requirement) =>
    !requirement.required || Boolean(
      requirement.requirement_code &&
      requirement.acceptance_type === 'checkbox' &&
      requirement.label &&
      requirement.document_version &&
      requirement.public_url &&
      (requirement.document_id || requirement.legal_bundle_version_document_id),
    ),
  );
}

function errorText(code?: string) {
  switch (code) {
    case "validation":
      return "Kontrollera obligatoriska uppgifter och försök igen.";
    case "consent":
      return "Du behöver godkänna villkor, prisvillkor och övriga obligatoriska godkännanden för att teckna elavtal.";
    case "legal_config":
      return "Avtalet kan inte tecknas online just nu. Kontakta kundservice så hjälper vi dig.";
    case "honeypot":
      return "Teckningen kunde inte skickas. Kontrollera uppgifterna och försök igen.";
    case "not_configured":
      return "Teckning online är inte aktiverad just nu.";
    case "ops_auth":
      return "Teckningen är inte rätt kopplad just nu. Kontakta kundservice så hjälper vi dig.";
    case "ops_validation":
      return "Vi kunde inte skicka teckningen just nu. Kontrollera att uppgifterna är ifyllda och försök igen.";
    case "idempotency_retry_failed":
      return "Vi kunde inte skicka teckningen just nu. Försök igen om en stund eller kontakta kundservice så hjälper vi dig.";
    case "idempotency_mismatch":
      return "Uppgifterna ändrades efter ett tidigare skickningsförsök. Vi har skapat ett nytt säkert försök – granska och skicka igen.";
    case "idempotency_in_progress":
      return "Samma teckning behandlas redan. Vänta en kort stund och kontrollera din e-post innan du försöker igen.";
    case "duplicate_application":
      return "En motsvarande teckning finns redan. Kontrollera e-post och Mina sidor eller kontakta kundservice innan du skickar en ny.";
    case "auth_email_mismatch":
      return "Bekräfta att teckningen ska använda en annan e-postadress än kontot du är inloggad på.";
    case "ops_unavailable":
      return "Vi kunde inte teckna just nu. Försök igen om en stund eller kontakta kundservice.";
    case "live_disabled":
      return "Teckning online är inte aktiverad just nu.";
    case "offer":
      return "Valt avtal kunde inte verifieras. Välj ett aktuellt avtal och försök igen.";
    case "snapshot":
      return "Vi kunde inte verifiera avtalssammanfattningen just nu. Uppdatera sidan och försök igen.";
    case "price_snapshot":
      return "Prisberäkningen saknas. Räkna priset innan du tecknar.";
    case "price_changed":
      return "Priset eller avtalet har ändrats. Räkna om priset och granska den uppdaterade teckningen.";
    case "area_mismatch":
      return "Vi kunde inte bekräfta elområdet för adressen. Kontrollera adressen och räkna om priset.";
    case "customer_type":
      return "Det valda avtalet är inte tillgängligt för den valda kundtypen. Välj ett aktuellt avtal.";
    case "rate_limit":
      return "För många försök på kort tid. Vänta en stund och försök igen.";
    default:
      return null;
  }
}

type OpsSignupFailureCode = Parameters<typeof errorText>[0];

type OpsErrorContext = {
  code: string;
  stage: string;
  field: string;
  previousStatus: string;
  previousErrorStage: string;
  previousErrorCode: string;
  previousErrorMessage: string;
  requestId: string;
  applicationId: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringFromRecord(
  record: Record<string, unknown> | null,
  keys: string[],
): string {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function opsErrorContext(error: unknown): OpsErrorContext {
  if (!isOpsError(error)) {
    return {
      code: "",
      stage: "",
      field: "",
      previousStatus: "",
      previousErrorStage: "",
      previousErrorCode: "",
      previousErrorMessage: "",
      requestId: "",
      applicationId: "",
    };
  }

  const details = asRecord((error as { details?: unknown }).details);
  const nestedError = asRecord(details?.error);
  const nestedDetails = asRecord(details?.details);

  return {
    code:
      stringFromRecord(details, ["code", "error_code", "errorCode"]) ||
      stringFromRecord(nestedError, ["code", "error_code", "errorCode"]),
    stage:
      stringFromRecord(details, ["error_stage", "stage", "errorStage"]) ||
      stringFromRecord(nestedError, ["stage", "error_stage", "errorStage"]),
    field:
      stringFromRecord(details, ["field"]) ||
      stringFromRecord(nestedError, ["field"]),
    previousStatus: stringFromRecord(nestedDetails, [
      "previous_status",
      "previousStatus",
    ]),
    previousErrorStage: stringFromRecord(nestedDetails, [
      "previous_error_stage",
      "previousErrorStage",
    ]),
    previousErrorCode: stringFromRecord(nestedDetails, [
      "previous_error_code",
      "previousErrorCode",
    ]),
    previousErrorMessage: stringFromRecord(nestedDetails, [
      "previous_error_message",
      "previousErrorMessage",
    ]),
    requestId:
      stringFromRecord(details, ["request_id", "requestId"]) ||
      stringFromRecord(nestedError, ["request_id", "requestId"]),
    applicationId: stringFromRecord(nestedDetails, [
      "application_id",
      "applicationId",
    ]),
  };
}

function opsErrorCode(error: unknown): OpsSignupFailureCode {
  if (!isOpsError(error)) return "ops_unavailable";

  const context = opsErrorContext(error);
  console.error("[website signup] OPS customer application failed", {
    status: error.status,
    message: error.message,
    code: context.code || null,
    stage: context.stage || null,
    previous_error_stage: context.previousErrorStage || null,
    previous_error_code: context.previousErrorCode || null,
    request_id: context.requestId || null,
    application_id: context.applicationId || null,
    details: (error as { details?: unknown }).details ?? null,
  });

  if (error.status === 503) return "live_disabled";
  if (error.status === 401 || error.status === 403) return "ops_auth";
  if (error.status === 400) return "ops_validation";
  if (error.status === 409) {
    if (/idempotency_key_payload_mismatch|idempotency.*mismatch/i.test(context.code)) return "idempotency_mismatch";
    if (/idempotency_in_progress|application_business_in_progress/i.test(context.code)) return "idempotency_in_progress";
    if (/duplicate|business_conflict/i.test(context.code)) return "duplicate_application";
    if (context.code === "idempotent_failed") return "idempotency_retry_failed";
    if (/public_contract|offer|contract/i.test(context.code)) return "offer";
    return "ops_unavailable";
  }
  if (error.status === 422) {
    if (/public_contract|offer|contract/i.test(context.code)) return "offer";
    if (/legal|consent|power_of_attorney|price_terms/i.test(context.code))
      return "consent";
    return "ops_validation";
  }

  return "ops_unavailable";
}

function opsFieldFailure(error: unknown): Pick<SignupSubmissionState, "step" | "fieldErrors"> {
  const context = opsErrorContext(error);
  const key = `${context.field} ${context.code} ${context.stage}`.toLowerCase();
  if (/requested.*date|start.*date|date_invalid|timestamp_invalid/.test(key)) {
    return { step: 0, fieldErrors: { requested_start_date: "Kontrollera önskat startdatum." } };
  }
  if (/personal.*number|signer.*identity/.test(key)) {
    return { step: 0, fieldErrors: { personal_number: "Kontrollera personnumret för personen som skriver under." } };
  }
  if (/organization.*number/.test(key)) {
    return { step: 0, fieldErrors: { organization_number: "Kontrollera organisationsnumret." } };
  }
  if (/email/.test(key)) return { step: 0, fieldErrors: { email: "Kontrollera e-postadressen." } };
  if (/phone/.test(key)) return { step: 0, fieldErrors: { phone: "Kontrollera telefonnumret." } };
  if (/facility|metering|site|address|postal|city|price_area/.test(key)) {
    return { step: 0, fieldErrors: { pricing: "Kontrollera adressen och räkna om priset." } };
  }
  if (/legal|consent|power_of_attorney|price_terms|terms|withdrawal/.test(key)) {
    return { step: 1, fieldErrors: { legal: "Kontrollera villkoren och de obligatoriska godkännandena." } };
  }
  return { step: 1 };
}
function safePortalStatus(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 80)
    : "skipped";
}


function parseOptionalNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePostalCodeForApplication(value: string): string {
  return digitsOnly(value).slice(0, 5);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidSwedishPostalCode(value: string): boolean {
  return /^\d{5}$/.test(value);
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value.trim(),
    );
}

function parseJsonSnapshot(value: string): Record<string, unknown> | null {
  if (!value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function sameContractSnapshot(
  offer: OpsPublicContract,
  snapshot: Record<string, unknown> | null,
): boolean {
  return validateContractDisplaySnapshot(offer, snapshot).ok;
}

function sameEmail(left: string | null | undefined, right: string): boolean {
  return Boolean(
    left && left.trim().toLowerCase() === right.trim().toLowerCase(),
  );
}

function publicApplicationMessage(
  value: Record<string, unknown> | null | undefined,
): string | null {
  const message = value?.message;
  return typeof message === "string" && message.trim()
    ? message.trim().slice(0, 500)
    : null;
}

function publicCaseReference(
  value: Record<string, unknown> | null | undefined,
): string | null {
  const raw = value?.case_reference ?? value?.caseReference;
  return typeof raw === "string" && raw.trim()
    ? raw.trim().slice(0, 120)
    : null;
}

function signerNameForApplication(input: {
  firstName: string;
  lastName: string;
}): string | null {
  return [input.firstName, input.lastName].filter(Boolean).join(" ") || null;
}

async function getCurrentPortalAuth() {
  try {
    const supabase = await createSupabaseServerActionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("external_customer_id")
      .eq("user_id", user.id)
      .maybeSingle<{ external_customer_id: string | null }>();
    return {
      id: user.id,
      email: user.email ?? null,
      externalCustomerId: profile?.external_customer_id ?? null,
    };
  } catch {
    return null;
  }
}

export default async function TecknaPage({
  searchParams,
}: {
  searchParams?: Promise<PageParams>;
}) {
  const params = (await searchParams) ?? {};
  const status = getOpsClientStatus();
  let contracts: OpsPublicContract[] = [];
  let loadError: string | null = null;

  if (status.configured) {
    try {
      const publicContracts = await fetchOpsPublicContracts();
      contracts = publicContracts.filter(isSignupReadyContract);
      const blocked = publicContracts.filter((contract) => !isSignupReadyContract(contract));
      if (blocked.length > 0) {
        console.warn("[website signup] blocked non-ready public contracts", {
          offers: blocked.map((contract) => ({
            offer_reference: contract.offer_reference,
            reasons: buildPublicContractDisplay(contract).blockedReasons,
          })),
        });
      }
    } catch {
      loadError = "Vi kunde inte hämta aktuella elavtal just nu.";
    }
  } else {
    loadError = "Teckning online är inte tillgänglig just nu.";
  }

  const checkoutContext = params.checkout
    ? await readWebsiteCheckoutContext(params.checkout).catch((error) => {
        console.error("[website signup] checkout context read failed", error);
        return null;
      })
    : null;
  const selectedContract = checkoutContext
    ? contracts.find((contract) => contract.offer_reference === checkoutContext.selectedOffer) ?? null
    : selectedContractFromParams(contracts, params);
  const signupOptions = contracts.map(toSignupContractOption);
  const selectedValue = selectedContract?.offer_reference ?? "";
  const currentAuth = await getCurrentPortalAuth();
  const pageError =
    errorText(params.error) ??
    (params.checkout && !checkoutContext
      ? "Prisberäkningen har gått ut eller kunde inte återställas. Räkna priset igen."
      : null) ??
    (params.offer && !selectedContract ? errorText("offer") : null);
  const canSubmit =
    status.configured &&
    status.liveSignupEnabled &&
    !loadError &&
    contracts.length > 0;

  async function submitApplicationAction(
    _previousState: SignupSubmissionState,
    formData: FormData,
  ): Promise<SignupSubmissionState> {
    "use server";

    const fail = (
      code: Parameters<typeof errorText>[0],
      options: Omit<SignupSubmissionState, "errorMessage"> = {},
    ): SignupSubmissionState => ({
      errorMessage:
        errorText(code) ??
        "Teckningen kunde inte skickas just nu. Försök igen.",
      ...options,
    });
    const currentStatus = getOpsClientStatus();
    if (!currentStatus.configured) return fail("not_configured");
    if (!currentStatus.liveSignupEnabled) return fail("live_disabled");

    const h = await headers();
    const ip = getClientIpFromHeaders(h);
    const userAgent = h.get("user-agent");
    const rate = await checkRateLimit(`signup:${ip ?? "unknown"}`, {
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.allowed) return fail("rate_limit");

    const honeypot = normalizeText(formData.get("company_website"));
    if (honeypot) return fail("honeypot");

    const selectedOffer = normalizeText(formData.get("selected_offer"));
    const liveContracts = await fetchOpsPublicContractsFresh().catch(() => []);
    const offer = liveContracts.find(
      (contract) =>
        contract.offer_reference === selectedOffer && isSignupReadyContract(contract),
    );

    if (!offer) return fail("offer");

    const customerTypeRaw = normalizeText(formData.get("customer_type"));
    const customerType = customerTypeRaw === "business" || customerTypeRaw === "company" ? "business" : "private";
    if (!contractSupportsCustomerType(offer.customer_types, customerType)) {
      return fail("customer_type");
    }
    const firstName = normalizeText(formData.get("first_name"));
    const lastName = normalizeText(formData.get("last_name"));
    const companyName = normalizeText(formData.get("company_name"));
    const personalNumber = normalizeText(formData.get("personal_number"));
    const organizationNumber = normalizeText(
      formData.get("organization_number"),
    );
    const companySignerRole = normalizeText(formData.get("company_signer_role"));
    const companySignerAuthorized =
      String(formData.get("company_signer_authorized") || "") === "on";
    const differentEmailConfirmed =
      String(formData.get("different_email_confirmed") || "") === "on";
    const email = normalizeEmail(formData.get("email"));
    const phoneInput = normalizeText(formData.get("phone"));
    const phone = normalizePhoneToE164(phoneInput);
    const address = normalizeText(formData.get("address"));
    const postalCode = normalizePostalCodeForApplication(
      normalizeText(formData.get("postal_code")),
    );
    const city = normalizeText(formData.get("city"));
    const facilityId = normalizeText(formData.get("facility_id"));
    const currentSupplierName = normalizeText(formData.get("current_supplier_name"));
    const currentSupplierId = normalizeText(formData.get("current_supplier_id"));
    const currentSupplierOrgNumber = normalizeText(formData.get("current_supplier_org_number"));
    const currentSupplierEdielId = normalizeText(formData.get("current_supplier_ediel_id"));
    const requestedStartModeRaw = normalizeText(
      formData.get("requested_start_mode"),
    );
    const requestedStartMode =
      requestedStartModeRaw === "specific_date" ? "specific_date" : "earliest_possible";
    const requestedStartDate = normalizeText(
      formData.get("requested_start_date"),
    );

    const legalRequirements = offer.legal_requirements ?? [];
    const legalConsents = Object.fromEntries(
      legalRequirements.map((requirement) => [
        requirement.requirement_code,
        String(formData.get(`legal_acceptance:${requirement.requirement_code}`) || "") === "on",
      ]),
    );
    const missingRequiredConsent = legalRequirements.some(
      (requirement) => requirement.required && legalConsents[requirement.requirement_code] !== true,
    );
    const powerOfAttorneyRequirement = legalRequirements.find(
      (requirement) => requirement.requirement_code === "power_of_attorney",
    );
    const powerOfAttorneyRequired = powerOfAttorneyRequirement?.required === true;
    const acceptPowerOfAttorney = legalConsents.power_of_attorney === true;
    const powerOfAttorneyTextVersionId =
      powerOfAttorneyRequirement?.legal_bundle_version_document_id ??
      powerOfAttorneyRequirement?.document_id ??
      offer.power_of_attorney_version_id ?? null;

    const hasIdentity =
      customerType === "business"
        ? Boolean(
            companyName &&
              organizationNumber &&
              firstName &&
              lastName &&
              personalNumber &&
              companySignerRole &&
              companySignerAuthorized,
          )
        : Boolean(firstName && lastName && personalNumber);

    const invalidBaseFields =
      !email ||
      !isValidEmail(email) ||
      !phone ||
      !address ||
      !isValidSwedishPostalCode(postalCode) ||
      !city ||
      !hasIdentity ||
      (customerType === "business" &&
        !isValidSwedishOrganizationNumber(organizationNumber)) ||
      !isValidSwedishPersonalNumber(personalNumber) ||
      !isValidRequestedStartDate(requestedStartMode, requestedStartDate);

    if (invalidBaseFields) {
      return fail("validation", {
        step: 0,
        fieldErrors: {
          form: "Kontrollera namn, identitetsnummer, kontaktuppgifter och startdatum.",
        },
      });
    }

    const currentAuth = await getCurrentPortalAuth();
    const authenticatedEmailMismatch = Boolean(
      currentAuth?.email && !sameEmail(currentAuth.email, email),
    );
    if (authenticatedEmailMismatch && !differentEmailConfirmed) {
      return fail("auth_email_mismatch", {
        step: 0,
        fieldErrors: {
          different_email_confirmed:
            "Bekräfta den andra e-postadressen eller använd e-posten för ditt inloggade konto.",
        },
      });
    }

    if (missingRequiredConsent) {
      return fail("consent", { step: 1 });
    }

    if (!isSignupReadyContract(offer)) {
      console.error("[website signup] selected offer is missing required OPS legal_text_versions UUIDs", {
        offer_reference: offer.offer_reference,
        terms_version_id: offer.terms_version_id ?? null,
        privacy_policy_version_id: offer.privacy_policy_version_id ?? null,
        withdrawal_version_id: offer.withdrawal_version_id ?? null,
        price_terms_version_id: offer.price_terms_version_id ?? null,
        power_of_attorney_required: powerOfAttorneyRequired,
        power_of_attorney_version_id: offer.power_of_attorney_version_id ?? null,
      });
      return fail("legal_config", { step: 1 });
    }

    const pricingPreviewSnapshot = parseJsonSnapshot(
      normalizeText(formData.get("pricing_preview_snapshot")),
    );
    const contractDisplaySnapshot = parseJsonSnapshot(
      normalizeText(formData.get("contract_display_snapshot")),
    );
    if (!contractDisplaySnapshot) {
      return fail("snapshot", { step: 1 });
    }
    if (!sameContractSnapshot(offer, contractDisplaySnapshot)) {
      console.warn("[website signup] contract display snapshot mismatch", {
        offer_reference: offer.offer_reference,
      });
      return fail("snapshot", { step: 1 });
    }

    const estimatedMonthlyKwh = parseOptionalNumber(
      normalizeText(formData.get("estimated_monthly_kwh")),
    );
    const annualConsumptionKwh = parseOptionalNumber(
      normalizeText(formData.get("annual_consumption_kwh")),
    );
    const consumptionProfile = normalizeWebsiteConsumptionProfile(
      parseJsonSnapshot(normalizeText(formData.get("consumption_profile"))),
    );
    if (
      !estimatedMonthlyKwh ||
      estimatedMonthlyKwh < 1 ||
      estimatedMonthlyKwh > 200000 ||
      !annualConsumptionKwh ||
      annualConsumptionKwh < 1 ||
      annualConsumptionKwh > 2_400_000 ||
      !consumptionProfile ||
      !consumptionProfileMatchesMonthlyKwh(consumptionProfile, estimatedMonthlyKwh) ||
      Math.abs(consumptionProfile.annual_kwh - annualConsumptionKwh) > 0.001
    ) {
      return fail("price_snapshot", {
        step: 0,
        requiresQuoteRefresh: true,
        fieldErrors: { pricing: "Förbrukningen eller prisberäkningen saknas eller är ogiltig." },
      });
    }

    const resolutionToken = normalizeText(formData.get("energy_area_resolution_token"));
    if (!resolutionToken) {
      return fail("area_mismatch", {
        step: 0,
        requiresQuoteRefresh: true,
        fieldErrors: { pricing: "Adressen behöver verifieras på nytt." },
      });
    }

    const submissionAttemptId = normalizeText(formData.get("submission_attempt_id"));
    if (!isUuid(submissionAttemptId)) {
      return fail("validation", { step: 1, rotateSubmissionAttempt: true });
    }
    const pricingQuoteToken = normalizeText(formData.get("pricing_snapshot_token"));
    const pricingSnapshotReference = normalizeText(formData.get("pricing_snapshot_reference"));
    const verifiedQuote = await validateCanonicalWebsiteQuote({
      pricingToken: pricingQuoteToken,
      pricingSnapshotReference,
      resolutionToken,
      contract: offer,
      customerType,
      estimatedMonthlyKwh,
      annualConsumptionKwh,
      requestedStartMode,
      requestedStartDate: requestedStartMode === "specific_date" ? requestedStartDate : null,
      location: { postalCode, city, address },
    });
    if (!verifiedQuote.ok) {
      console.warn("[website signup] canonical quote verification failed", {
        reason: verifiedQuote.reason,
        offer_reference: offer.offer_reference,
      });
      return fail("price_changed", {
        step: 0,
        requiresQuoteRefresh: true,
        fieldErrors: { pricing: "Uppgifterna behöver verifieras igen. Hämta priset på nytt." },
      });
    }
    const serverPriceAreaCode = verifiedQuote.value.area.priceAreaCode;
    const serverResolution = verifiedQuote.value.area;
    const signedPreview = quoteToWebsitePricingPreview(verifiedQuote.value.quote, pricingQuoteToken);
    const pricingValidation = validatePricingPreviewSnapshot({
      contract: offer,
      snapshot: pricingPreviewSnapshot,
      livePreview: signedPreview,
      expectedPriceArea: serverPriceAreaCode,
      expectedMonthlyKwh: estimatedMonthlyKwh,
    });
    if (!pricingValidation.ok) {
      console.warn("[website signup] signed pricing preview snapshot mismatch", {
        reasons: pricingValidation.reasons,
        offer_reference: offer.offer_reference,
        });
      return fail("price_changed", {
        step: 0,
        requiresQuoteRefresh: true,
        fieldErrors: { pricing: "Uppgifterna stämmer inte med den signerade offerten. Hämta priset på nytt." },
      });
    }
    const canonicalPricingPreviewSnapshot: Record<string, unknown> = {
      ...(signedPreview as unknown as Record<string, unknown>),
      consumption_profile: consumptionProfile,
    };

    const idempotencyKey = `website-application:${submissionAttemptId}`;
    const externalApplicationId = createExternalApplicationId(submissionAttemptId);
    const canLinkCurrentAuth = !authenticatedEmailMismatch;
    const linkedAuthUserId = canLinkCurrentAuth ? (currentAuth?.id ?? null) : null;
    const externalCustomerId =
      (canLinkCurrentAuth ? currentAuth?.externalCustomerId : null) ??
      createExternalCustomerId([
        "gridex_website_customer_v2",
        customerType,
        customerType === "business" ? organizationNumber : personalNumber,
      ]);

    const signedPayloadHash = submissionPayloadHash({
      submissionAttemptId,
      externalApplicationId,
      externalCustomerId,
      offerReference: offer.offer_reference,
      customerType,
      firstName,
      lastName,
      companyName,
      personalNumber,
      organizationNumber,
      companySignerRole,
      companySignerAuthorized,
      differentEmailConfirmed,
      email,
      phone,
      address,
      postalCode,
      city,
      facilityId,
      currentSupplierName,
      currentSupplierId,
      currentSupplierOrgNumber,
      currentSupplierEdielId,
      requestedStartMode,
      requestedStartDate,
      serverPriceAreaCode,
      gridAreaCode: serverResolution.gridAreaCode,
      gridOwnerId: serverResolution.gridOwnerId,
      gridOwnerName: serverResolution.gridOwnerName,
      energyResolutionStatus: "resolved",
      energyResolutionConfidence: serverResolution.confidence,
      pricingSnapshotReference: verifiedQuote.value.quote.pricing_snapshot_reference,
      annualConsumptionKwh,
      quoteToken: pricingQuoteToken,
      canonicalPricingPreviewSnapshot,
      consumptionProfile,
      contractDisplaySnapshot,
      linkedAuthUserId,
      consents: legalConsents,
    });

    let acceptedAt: string;
    let immutableContext: Awaited<ReturnType<typeof prepareWebsiteSubmission>>["requestContext"];
    try {
      const prepared = await prepareWebsiteSubmission({
        submissionAttemptId,
        userId: linkedAuthUserId,
        idempotencyKey,
        externalApplicationId,
        externalCustomerId,
        offerReference: offer.offer_reference,
        payloadHash: signedPayloadHash,
        pricingQuoteSnapshot: canonicalPricingPreviewSnapshot,
        contractDisplaySnapshot,
        requestContext: {
          ipAddress: ip,
          ipHash: hashIp(ip),
          userAgent,
          utmSource: normalizeText(formData.get("utm_source")) || null,
          utmMedium: normalizeText(formData.get("utm_medium")) || null,
          utmCampaign: normalizeText(formData.get("utm_campaign")) || null,
        },
      });
      acceptedAt = prepared.acceptedAt;
      immutableContext = prepared.requestContext;
    } catch (error) {
      console.error("[website signup] immutable submission preparation failed", error);
      const mismatch =
        error instanceof Error && /payload changed|idempotency/i.test(error.message);
      return fail(mismatch ? "idempotency_mismatch" : "ops_unavailable", {
        step: 1,
        rotateSubmissionAttempt: mismatch,
      });
    }

    const powerOfAttorney =
      powerOfAttorneyRequired && acceptPowerOfAttorney
        ? {
            accepted: true,
            scope: ["supplier_switch", "facility_information_lookup"],
            signerName: signerNameForApplication({
              firstName,
              lastName,
            }),
            signerIdentityNumber: personalNumber,
            method: "website_acceptance",
            acceptedAt,
            textVersionId: powerOfAttorneyTextVersionId,
            ipAddress: immutableContext.ipAddress,
            userAgent: immutableContext.userAgent,
          }
        : null;

    const applicationInput = {
      offer_reference: offer.offer_reference,
      quote_reference: verifiedQuote.value.quote.ops_quote_reference,
      annual_consumption_kwh: annualConsumptionKwh,
      customer_type: customerType,
      first_name: firstName || null,
      last_name: lastName || null,
      company_name: companyName || null,
      personal_number: personalNumber || null,
      organization_number: organizationNumber || null,
      email,
      phone,
      address,
      postal_code: postalCode,
      city,
      facility_id: facilityId || null,
      grid_area_code: serverResolution.gridAreaCode,
      grid_owner_id: serverResolution.gridOwnerId,
      grid_owner_name: serverResolution.gridOwnerName,
      requested_start_mode: requestedStartMode,
      requested_start_date:
        requestedStartMode === "specific_date" ? requestedStartDate || null : null,
      price_area_code: serverPriceAreaCode,
      current_supplier_name: currentSupplierName || null,
      current_supplier_id: currentSupplierId || null,
      current_supplier_org_number: currentSupplierOrgNumber || null,
      current_supplier_ediel_id: currentSupplierEdielId || null,
      source: process.env.GRIDEX_WEBSITE_SOURCE?.trim() || "gridex.se",
      idempotency_key: idempotencyKey,
      external_customer_id: externalCustomerId,
      customer_portal_user_id: linkedAuthUserId,
      auth_user_id: linkedAuthUserId,
      consents: legalConsents,
      legal_acceptances: legalRequirements.map((requirement) => ({
        requirement_code: requirement.requirement_code,
        accepted: legalConsents[requirement.requirement_code] === true,
        document_id: requirement.document_id,
        legal_bundle_version_document_id: requirement.legal_bundle_version_document_id,
        document_version: requirement.document_version,
        document_hash: requirement.document_hash,
        accepted_at: acceptedAt,
      })),
      powerOfAttorney,
    } satisfies OpsCustomerApplicationInput;

    try {
      await lockWebsiteSubmissionOpsPayload({
        submissionAttemptId,
        opsPayloadHash: submissionPayloadHash(
          buildOpsCustomerApplicationPayload(applicationInput),
        ),
      });
      await updateWebsiteSubmission({ submissionAttemptId, status: "submitting" });
    } catch (error) {
      console.error("[website signup] exact OPS payload lock failed", error);
      const mismatch =
        error instanceof Error && /payload changed|idempotency/i.test(error.message);
      return fail(mismatch ? "idempotency_mismatch" : "ops_unavailable", {
        step: 1,
        rotateSubmissionAttempt: mismatch,
      });
    }

    const submitApplicationToOps = () => submitOpsCustomerApplication(applicationInput);

    let result: Awaited<ReturnType<typeof submitOpsCustomerApplication>>;
    try {
      result = await submitApplicationToOps();
      await updateWebsiteSubmission({
        submissionAttemptId,
        status: "accepted",
        opsApplicationId: result.application_id ?? null,
        opsCustomerId: result.customer_id ?? null,
        opsApplicationNumber: result.application_number ?? null,
        opsContractId: result.contract_id ?? null,
        opsResultSnapshot: result.raw ?? null,
        contractStatus: result.contract_status ?? null,
        signedAt: result.signed_at ?? null,
        withdrawalDeadlineAt: result.withdrawal_deadline_at ?? null,
        signatureSnapshotSha256: result.signature_snapshot_sha256 ?? null,
        canSendAgreementConfirmation: result.can_send_agreement_confirmation ?? null,
        canStartSwitch: result.can_start_switch ?? null,
        communication: result.communication?.raw ?? null,
      });
    } catch (error) {
      const context = opsErrorContext(error);
      await updateWebsiteSubmission({
        submissionAttemptId,
        status: "failed",
        errorCode: context.code || null,
        errorMessage: error instanceof Error ? error.message : String(error),
      }).catch((storageError) => {
        console.error("[website signup] failed to persist submission error", storageError);
      });
      const publicCode = opsErrorCode(error);
      const fieldFailure = opsFieldFailure(error);
      return fail(publicCode, {
        ...fieldFailure,
        step:
          publicCode === "offer"
            ? 0
            : fieldFailure.step,
        rotateSubmissionAttempt:
          publicCode === "idempotency_mismatch" ||
          publicCode === "idempotency_retry_failed",
        requiresQuoteRefresh: publicCode === "offer",
      });
    }

    if (linkedAuthUserId) {
      const portalIdentity = {
        userId: linkedAuthUserId,
        email,
        customerNumber: result.customer_number ?? null,
        externalCustomerId: result.external_customer_id ?? externalCustomerId,
      };
      const portalSyncOperationId = `signup:${submissionAttemptId}`;
      const portalSyncMetadata = { source: "gridex_web_successful_signup" };
      try {
        await submitOpsCustomerPortalSync({
          identity: portalIdentity,
          idempotencyKey: portalSyncOperationId,
          customerNumber: portalIdentity.customerNumber,
          externalCustomerId: portalIdentity.externalCustomerId,
          email,
          metadata: portalSyncMetadata,
        });
      } catch (error) {
        if (isTransientOpsError(error)) {
          await enqueuePortalWrite({
            userId: linkedAuthUserId,
            operationType: "customer_portal_sync",
            idempotencyKey: `customer-portal-sync:${linkedAuthUserId}:${portalSyncOperationId}`,
            identity: portalIdentity,
            payload: {
              operation_id: portalSyncOperationId,
              customer_number: portalIdentity.customerNumber,
              external_customer_id: portalIdentity.externalCustomerId,
              email,
              metadata: portalSyncMetadata,
            },
          }).catch((outboxError) => {
            console.error("[website signup] portal sync outbox failed", outboxError);
          });
        } else {
          console.error("[website signup] portal sync needs manual identity review", error);
        }
      }
    }

    const portalOnboarding = await ensureCustomerPortalOnboarding({
      application: result,
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      companyName: companyName || null,
      phone,
      customerType,
      address,
      postalCode,
      city,
      facilityId: facilityId || null,
      meteringPointId: null,
      offerReference: offer.offer_reference,
      productCode: offer.product_code ?? null,
      contractName: offer.name,
      authenticatedUserId: linkedAuthUserId,
    }).catch((error) => {
      console.error(
        "[website signup] non-blocking portal onboarding failed after successful OPS application",
        error,
      );
      return { status: "failed" as const, message: "portal_onboarding_failed" };
    });

    let successRedirect = "/teckna-avtal/tack";
    try {
      const resultToken = await createWebsiteApplicationResult({
        submissionAttemptId,
        userId: linkedAuthUserId,
        result: {
          status: result.status,
          portalStatus: safePortalStatus(portalOnboarding.status),
          portalMessage: portalOnboarding.message?.slice(0, 500) ?? null,
          customerNumber: result.customer_number ?? null,
          contractNumber: result.contract_number ?? null,
          applicationNumber: result.application_number ?? null,
          nextStep: result.next_step ?? null,
          nextActionMessage: publicApplicationMessage(result.nextAction),
          caseReference: publicCaseReference(result.manualInformationRequest),
          powerOfAttorneySigned: Boolean(result.power_of_attorney_id),
          missingFields: result.missing_fields,
          contractStatus: result.contract_status ?? null,
          signedAt: result.signed_at ?? null,
          withdrawalDeadlineAt: result.withdrawal_deadline_at ?? null,
          canSendAgreementConfirmation: result.can_send_agreement_confirmation ?? null,
          canStartSwitch: result.can_start_switch ?? null,
          canCreateSupplierSwitchRequest:
            result.can_create_supplier_switch_request ?? null,
          canDispatchSupplierSwitch: result.can_dispatch_supplier_switch ?? null,
          supplierSwitchStatus: result.supplier_switch_status ?? null,
          blockingReasons: result.blocking_reasons,
          warnings: result.warnings,
          communicationQueued: result.communication?.queued ?? [],
          communicationSent: result.communication?.sent ?? [],
          communicationFailed: result.communication?.failed ?? [],
        },
      });
      successRedirect = `/teckna-avtal/tack?result=${encodeURIComponent(resultToken)}`;
    } catch (error) {
      console.error("[website signup] result token storage failed after successful application", error);
    }

    return redirect(successRedirect);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 py-12 md:py-16">
      <FaqJsonLd items={checkoutFaqItems} />
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F17] p-8 md:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-[120px]" />

        <div className="relative grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
              Välj avtal • Granska uppgifter • Teckna elavtal
            </div>

            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
                Teckna elavtal
                <br />
                steg för steg
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
                Välj elavtal, fyll i dina uppgifter och granska allt innan du
                tecknar. Avtalsstart sker först när Gridex har kontrollerat
                uppgifterna och bekräftat nästa steg.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/elavtal"
                className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-cyan-500/40 hover:bg-white/5"
              >
                Jämför elavtal
              </Link>
              <Link
                href="/kundservice"
                className="rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-cyan-500/40 hover:bg-white/5"
              >
                Få hjälp
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <StepCard
              title="1. Välj avtal"
              text="Se månadsavgift, påslag och fakturaavgift innan du går vidare."
            />
            <StepCard
              title="2. Fyll i uppgifter"
              text="Privat- och företagsfält visas separat. Anläggningsuppgifter kan kompletteras senare."
            />
            <StepCard
              title="3. Granska och teckna"
              text="Kontrollera sammanfattningen och godkänn juridiska dokument var för sig."
            />
          </div>
        </div>
      </section>

      {pageError ? (
        <div
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100"
          role="alert"
        >
          {pageError}
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          {loadError} Teckning är därför tillfälligt pausad.
        </div>
      ) : null}

      {!status.liveSignupEnabled ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Teckning online är inte aktiverad just nu. Kontakta kundservice om du
          vill ha hjälp.
        </div>
      ) : null}

      <SignupFlowClient
        contracts={signupOptions}
        initialSelectedValue={selectedValue}
        initialCustomerType={checkoutContext?.customerType ?? "private"}
        authenticatedEmail={currentAuth?.email ?? null}
        canSubmit={canSubmit}
        utm={{
          utm_source: params.utm_source,
          utm_medium: params.utm_medium,
          utm_campaign: params.utm_campaign,
        }}
        action={submitApplicationAction}
        initialPricingPreview={checkoutContext?.pricingPreview ?? null}
        initialQuoteContext={checkoutContext?.quoteContext ?? null}
      />

      <FaqList
        items={checkoutFaqItems.slice(0, 8)}
        title="Vanliga frågor om att teckna"
        showAllLink
      />
    </div>
  );
}

function StepCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-1 text-sm text-gray-400">{text}</p>
    </div>
  );
}
