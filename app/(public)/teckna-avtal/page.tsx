import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import SignupFlowClient from "@/components/signup/SignupFlowClient";
import {
  type SignupContractOption,
  type SignupSubmissionState,
} from "@/components/signup/CustomerApplicationForm";
import {
  createApplicationIdempotencyKey,
  createExternalApplicationId,
  createExternalCustomerId,
  fetchOpsPublicContracts,
  fetchOpsPublicContractsFresh,
  getOpsClientStatus,
  hashIp,
  isOpsError,
  submitOpsCustomerApplication,
  type OpsPublicContract,
} from "@/lib/ops/client";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { resolveWebsitePriceAreaForPricing } from "@/lib/website/priceAreaResolver";
import { validateContractDisplaySnapshot } from "@/lib/website/snapshotValidation";
import { ensureCustomerPortalOnboarding } from "@/lib/customerPortal/onboarding";
import { contractSupportsCustomerType } from "@/lib/website/customerType";
import { buildLocalWebsitePricingPreview } from "@/lib/website/localPricingPreview";

export const metadata: Metadata = {
  title: "Teckna elavtal – Gridex",
  description:
    "Teckna elavtal hos Gridex. Välj avtal, granska pris och avgifter, godkänn villkor och få bekräftelse på nästa steg.",
  alternates: { canonical: "https://gridex.se/teckna-avtal" },
};

type PageParams = {
  offer?: string;
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
    invoiceFeeSek: item.invoice_fee_sek,
    markupOrePerKwh: item.markup_ore_per_kwh,
    variableMarkupOrePerKwh: item.variable_markup_ore_per_kwh,
    fixedPriceOrePerKwh: item.fixed_price_ore_per_kwh,
    monthlyFixedPriceSek: item.monthly_fixed_price_sek ?? null,
    elcertOrePerKwh: item.elcert_ore_per_kwh ?? null,
    portfolioPriceOrePerKwh: item.portfolio_price_ore_per_kwh ?? null,
    vatRate: item.vat_rate ?? null,
    pricingModel: item.pricing_model ?? null,
    spotShare: item.spot_share ?? null,
    portfolioShare: item.portfolio_share ?? null,
    validFrom: item.valid_from ?? null,
    validTo: item.valid_to ?? null,
    bindingPeriodMonths: item.binding_period_months ?? null,
    noticePeriodDays: item.notice_period_days ?? null,
    included: item.included ?? null,
    excluded: item.excluded ?? null,
    startInfo: item.start_info ?? null,
    customerTypes: item.customer_types ?? null,
    termsVersion: item.terms_version ?? null,
    privacyPolicyVersion: item.privacy_policy_version ?? null,
    cancellationRightVersion: item.cancellation_right_version ?? null,
    powerOfAttorneyVersion: item.power_of_attorney_version ?? null,
    powerOfAttorneyRequired: item.power_of_attorney_required ?? false,
    priceTermsVersion: item.price_terms_version ?? null,
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

function errorText(code?: string) {
  switch (code) {
    case "validation":
      return "Kontrollera obligatoriska uppgifter och försök igen.";
    case "consent":
      return "Du behöver godkänna villkor, prisvillkor och övriga obligatoriska godkännanden för att teckna elavtal.";
    case "honeypot":
      return "Teckningen kunde inte skickas. Kontrollera uppgifterna och försök igen.";
    case "not_configured":
      return "Teckning online är inte aktiverad just nu.";
    case "ops_auth":
      return "Teckningen är inte rätt kopplad just nu. Kontakta kundservice så hjälper vi dig.";
    case "ops_validation":
      return "Vi kunde inte skicka teckningen med uppgifterna som angavs. Kontrollera uppgifterna och försök igen.";
    case "ops_unavailable":
      return "Vi kunde inte teckna just nu. Försök igen om en stund eller kontakta kundservice.";
    case "live_disabled":
      return "Teckning online är inte aktiverad just nu.";
    case "offer":
      return "Valt avtal kunde inte verifieras. Välj ett aktuellt avtal och försök igen.";
    case "snapshot":
      return "Avtalet har uppdaterats sedan sidan laddades. Välj avtalet igen och kontrollera sammanfattningen.";
    case "price_snapshot":
      return "Prisberäkningen saknas. Räkna priset innan du tecknar.";
    case "price_changed":
      return "Valt avtal kunde inte tecknas med uppgifterna just nu. Kontrollera sammanfattningen och försök igen.";
    case "area_mismatch":
      return "Vi kunde inte bekräfta elområdet för adressen. Kontrollera adressen och räkna om priset utan manuellt elområde om möjligt.";
    case "customer_type":
      return "Det valda avtalet är inte tillgängligt för den valda kundtypen. Välj ett aktuellt avtal.";
    case "rate_limit":
      return "För många försök på kort tid. Vänta en stund och försök igen.";
    default:
      return null;
  }
}

function opsErrorCode(error: unknown): Parameters<typeof errorText>[0] {
  if (!isOpsError(error)) return "ops_unavailable";

  console.error("[website signup] OPS customer application failed", {
    status: error.status,
    message: error.message,
    details: (error as { details?: unknown }).details ?? null,
  });

  if (error.status === 503) return "live_disabled";
  if (error.status === 401 || error.status === 403) return "ops_auth";
  if (error.status === 400) return "ops_validation";
  if (error.status === 409) return "price_changed";
  if (error.status === 422) {
    const details = (error as { details?: unknown }).details;
    const code =
      typeof details === "object" && details && "code" in details
        ? String((details as { code?: unknown }).code ?? "")
        : "";
    if (/public_contract|offer|contract/i.test(code)) return "offer";
    if (/legal|consent|power_of_attorney|price_terms/i.test(code))
      return "consent";
    return "ops_validation";
  }

  return "ops_unavailable";
}

function safePortalStatus(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 80)
    : "skipped";
}

function missingFieldsToQuery(fields: string[]) {
  return fields.slice(0, 8).join(",");
}

function parseOptionalNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
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

function isValidIdentityNumber(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.length === 10 || digits.length === 12;
}

function isValidPhone(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.length >= 7 && digits.length <= 15;
}

function todayInStockholm(): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day
    ? `${year}-${month}-${day}`
    : new Date().toISOString().slice(0, 10);
}

function isValidRequestedStartDate(
  mode: "asap" | "specific_date",
  value: string,
): boolean {
  if (mode === "asap") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return value >= todayInStockholm();
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
  customerType: "private" | "company";
  firstName: string;
  lastName: string;
  companyName: string;
}): string | null {
  if (input.customerType === "company") return input.companyName || null;
  return [input.firstName, input.lastName].filter(Boolean).join(" ") || null;
}

async function getCurrentPortalAuth() {
  try {
    const supabase = await createSupabaseServerActionClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user ? { id: user.id, email: user.email ?? null } : null;
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
      contracts = await fetchOpsPublicContracts();
    } catch {
      loadError = "Vi kunde inte hämta aktuella elavtal just nu.";
    }
  } else {
    loadError = "Teckning online är inte tillgänglig just nu.";
  }

  const selectedContract = selectedContractFromParams(contracts, params);
  const signupOptions = contracts.map(toSignupContractOption);
  const selectedValue = selectedContract?.offer_reference ?? "";
  const pageError =
    errorText(params.error) ??
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
    ): SignupSubmissionState => ({
      errorMessage:
        errorText(code) ??
        "Teckningen kunde inte skickas just nu. Försök igen.",
    });
    const currentStatus = getOpsClientStatus();
    if (!currentStatus.configured) return fail("not_configured");
    if (!currentStatus.liveSignupEnabled) return fail("live_disabled");

    const h = await headers();
    const ip = getClientIpFromHeaders(h);
    const userAgent = h.get("user-agent");
    const rate = checkRateLimit(`signup:${ip ?? "unknown"}`, {
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    if (!rate.allowed) return fail("rate_limit");

    const honeypot = normalizeText(formData.get("company_website"));
    if (honeypot) return fail("honeypot");

    const selectedOffer = normalizeText(formData.get("selected_offer"));
    const liveContracts = await fetchOpsPublicContractsFresh().catch(() => []);
    const offer = liveContracts.find(
      (contract) => contract.offer_reference === selectedOffer,
    );

    if (!offer) return fail("offer");

    const customerTypeRaw = normalizeText(formData.get("customer_type"));
    const customerType = customerTypeRaw === "company" ? "company" : "private";
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
    const email = normalizeEmail(formData.get("email"));
    const phone = normalizeText(formData.get("phone"));
    const address = normalizeText(formData.get("address"));
    const postalCode = normalizePostalCodeForApplication(
      normalizeText(formData.get("postal_code")),
    );
    const city = normalizeText(formData.get("city"));
    const apartment = normalizeText(formData.get("apartment"));
    const facilityId = normalizeText(formData.get("facility_id"));
    const meteringPointId = normalizeText(formData.get("metering_point_id"));
    const requestedStartModeRaw = normalizeText(
      formData.get("requested_start_mode"),
    );
    const requestedStartMode =
      requestedStartModeRaw === "specific_date" ? "specific_date" : "asap";
    const requestedStartDate = normalizeText(
      formData.get("requested_start_date"),
    );

    const acceptTerms = String(formData.get("accept_terms") || "") === "on";
    const acceptPrivacy = String(formData.get("accept_privacy") || "") === "on";
    const acceptPowerOfAttorney =
      String(formData.get("accept_power_of_attorney") || "") === "on";
    const acceptCancellation =
      String(formData.get("accept_cancellation_right") || "") === "on";
    const acceptPriceTerms =
      String(formData.get("accept_price_terms") || "") === "on";
    const powerOfAttorneyRequired = offer.power_of_attorney_required === true;

    const hasIdentity =
      customerType === "company"
        ? Boolean(companyName && organizationNumber)
        : Boolean(firstName && lastName && personalNumber);

    const invalidBaseFields =
      !email ||
      !isValidEmail(email) ||
      !phone ||
      !isValidPhone(phone) ||
      !address ||
      !isValidSwedishPostalCode(postalCode) ||
      !city ||
      !hasIdentity ||
      (customerType === "company" &&
        !isValidIdentityNumber(organizationNumber)) ||
      (customerType === "private" && !isValidIdentityNumber(personalNumber)) ||
      !isValidRequestedStartDate(requestedStartMode, requestedStartDate);

    if (invalidBaseFields) {
      return fail("validation");
    }

    if (
      !acceptTerms ||
      !acceptPrivacy ||
      !acceptCancellation ||
      !acceptPriceTerms ||
      (powerOfAttorneyRequired && !acceptPowerOfAttorney)
    ) {
      return fail("consent");
    }

    const pricingPreviewSnapshot = parseJsonSnapshot(
      normalizeText(formData.get("pricing_preview_snapshot")),
    );
    const contractDisplaySnapshot = parseJsonSnapshot(
      normalizeText(formData.get("contract_display_snapshot")),
    );
    if (
      !contractDisplaySnapshot ||
      !sameContractSnapshot(offer, contractDisplaySnapshot)
    ) {
      return fail("snapshot");
    }

    const estimatedMonthlyKwh = parseOptionalNumber(
      normalizeText(formData.get("estimated_monthly_kwh")),
    );
    if (
      !estimatedMonthlyKwh ||
      estimatedMonthlyKwh < 1 ||
      estimatedMonthlyKwh > 200000
    ) {
      return fail("price_snapshot");
    }

    const submittedGridAreaCode = normalizeText(formData.get("grid_area_code"));
    const submittedGridOwnerId = normalizeText(formData.get("grid_owner_id"));
    const submittedGridOwnerName = normalizeText(
      formData.get("grid_owner_name"),
    );

    const serverResolution = await resolveWebsitePriceAreaForPricing({
      postal_code: postalCode,
      city,
      address,
      street: address,
    }).catch(() => null);
    const serverPriceAreaCode = serverResolution?.price_area_code;
    if (!serverPriceAreaCode) return fail("area_mismatch");

    let canonicalPricingPreviewSnapshot: Record<string, unknown>;
    try {
      canonicalPricingPreviewSnapshot = (await buildLocalWebsitePricingPreview({
        contract: offer,
        priceAreaCode: serverPriceAreaCode,
        estimatedMonthlyKwh,
      })) as unknown as Record<string, unknown>;
    } catch (error) {
      console.error(
        "[website signup] price audit snapshot could not be rebuilt; using submitted preview",
        error,
      );
      canonicalPricingPreviewSnapshot = pricingPreviewSnapshot ?? {
        contract: {
          offer_reference: offer.offer_reference,
          name: offer.name,
          contractType: offer.type,
        },
        priceArea: serverPriceAreaCode,
        price_area_code: serverPriceAreaCode,
        kwh: estimatedMonthlyKwh,
        audit_note: "submitted_without_server_recalculation",
      };
    }

    const idempotencyKey = createApplicationIdempotencyKey([
      "gridex_website_application_v1",
      email,
      customerType,
      customerType === "company" ? organizationNumber : personalNumber,
      address,
      postalCode,
      offer.offer_reference,
      requestedStartMode,
      requestedStartDate || "asap",
    ]);

    const currentAuth = await getCurrentPortalAuth();
    const canLinkCurrentAuth =
      !currentAuth?.email || sameEmail(currentAuth.email, email);
    const linkedAuthUserId = canLinkCurrentAuth
      ? (currentAuth?.id ?? null)
      : null;
    const externalCustomerId = createExternalCustomerId([
      "gridex_website_customer_v1",
      email,
      customerType,
      customerType === "company" ? organizationNumber : personalNumber,
    ]);

    const powerOfAttorney =
      powerOfAttorneyRequired && acceptPowerOfAttorney
        ? {
            accepted: true,
            scope: ["supplier_switch", "facility_information_lookup"],
            signerName: signerNameForApplication({
              customerType,
              firstName,
              lastName,
              companyName,
            }),
            signerIdentityNumber:
              customerType === "company" ? organizationNumber : personalNumber,
            method: "website_acceptance",
            acceptedAt: new Date().toISOString(),
            textVersionId: offer.power_of_attorney_version ?? null,
            ipAddress: ip,
            userAgent,
          }
        : null;

    let result: Awaited<ReturnType<typeof submitOpsCustomerApplication>>;

    try {
      result = await submitOpsCustomerApplication({
        offer_reference: offer.offer_reference,
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
        apartment: apartment || null,
        facility_id: facilityId || null,
        metering_point_id: meteringPointId || null,
        requested_start_mode: requestedStartMode,
        requested_start_date:
          requestedStartMode === "specific_date"
            ? requestedStartDate || null
            : null,
        price_area_code: serverPriceAreaCode,
        grid_area_code:
          serverResolution?.grid_area_code ?? (submittedGridAreaCode || null),
        grid_owner_id:
          serverResolution?.grid_owner_id ?? (submittedGridOwnerId || null),
        grid_owner_name:
          serverResolution?.grid_owner_name ?? (submittedGridOwnerName || null),
        energy_resolution_status: serverResolution?.status ?? null,
        energy_resolution_confidence: serverResolution?.confidence ?? null,
        estimated_monthly_kwh: estimatedMonthlyKwh,
        pricing_preview_snapshot: canonicalPricingPreviewSnapshot,
        contract_display_snapshot: contractDisplaySnapshot,
        source: "gridex_website",
        idempotency_key: idempotencyKey,
        external_customer_id: externalCustomerId,
        external_application_id: createExternalApplicationId(),
        customer_portal_user_id: linkedAuthUserId,
        auth_user_id: linkedAuthUserId,
        utm_source: normalizeText(formData.get("utm_source")) || null,
        utm_medium: normalizeText(formData.get("utm_medium")) || null,
        utm_campaign: normalizeText(formData.get("utm_campaign")) || null,
        user_agent: userAgent,
        ip_hash: hashIp(ip),
        consents: {
          terms: acceptTerms,
          privacy_policy: acceptPrivacy,
          withdrawal: acceptCancellation,
          power_of_attorney: powerOfAttorneyRequired
            ? acceptPowerOfAttorney
            : false,
          price_terms: acceptPriceTerms,
        },
        powerOfAttorney,
      });
    } catch (error) {
      return fail(opsErrorCode(error));
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
      meteringPointId: meteringPointId || null,
      offerReference: offer.offer_reference,
      productCode: offer.product_code ?? null,
      contractName: offer.name,
    }).catch((error) => {
      console.error(
        "[website signup] non-blocking portal onboarding failed after successful OPS application",
        error,
      );
      return { status: "failed" as const, message: "portal_onboarding_failed" };
    });

    const qs = new URLSearchParams();
    qs.set("status", result.status);
    qs.set("portal", safePortalStatus(portalOnboarding.status));
    if (result.customer_number)
      qs.set("customerNumber", result.customer_number);
    if (result.contract_number)
      qs.set("contractNumber", result.contract_number);
    if (result.application_number)
      qs.set("applicationNumber", result.application_number);
    if (result.next_step) qs.set("nextStep", result.next_step);
    const nextActionMessage = publicApplicationMessage(result.nextAction);
    if (nextActionMessage) qs.set("nextActionMessage", nextActionMessage);
    const caseReference = publicCaseReference(result.manualInformationRequest);
    if (caseReference) qs.set("caseReference", caseReference);
    if (result.power_of_attorney_id) qs.set("poa", "signed");
    if (result.missing_fields.length > 0) {
      qs.set("missing", missingFieldsToQuery(result.missing_fields));
    }

    const successRedirect = `/teckna-avtal/tack?${qs.toString()}`;

    redirect(successRedirect);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 py-12 md:py-16">
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
        canSubmit={canSubmit}
        utm={{
          utm_source: params.utm_source,
          utm_medium: params.utm_medium,
          utm_campaign: params.utm_campaign,
        }}
        action={submitApplicationAction}
        initialPricingPreview={null}
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
