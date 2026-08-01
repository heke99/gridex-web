"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  buildPublicContractDisplay,
  publicContractTypeLabel,
  type PublicContractDisplay,
} from "@/lib/website/publicContractDisplay";
import type { PublicLegalRequirement } from "@/lib/website/publicContractContract";
import type { WebsiteCustomerType } from "@/lib/website/customerType";
import type { WebsiteConsumptionProfile } from "@/lib/website/consumptionEstimator";
import {
  signupContractOptionAsOpsContract,
  type SignupContractOption,
} from "@/lib/website/signupContractOption";
import type {
  WebsiteEnergyResolution,
  WebsitePricingPreview,
  WebsitePricingQuoteContext,
} from "@/lib/website/publicApi";
import {
  isValidSwedishOrganizationNumber,
  isValidSwedishPersonalNumber,
  normalizePhoneToE164,
} from "@/lib/website/signupValidation";

export type { SignupContractOption } from "@/lib/website/signupContractOption";

export type SignupSubmissionState = {
  errorMessage?: string | null;
  fieldErrors?: Record<string, string>;
  step?: 0 | 1;
  rotateSubmissionAttempt?: boolean;
  requiresQuoteRefresh?: boolean;
};

type Props = {
  contracts: SignupContractOption[];
  selectedValue: string;
  customerType: WebsiteCustomerType;
  canSubmit: boolean;
  authenticatedEmail?: string | null;
  utm: { utm_source?: string; utm_medium?: string; utm_campaign?: string };
  action: (state: SignupSubmissionState, formData: FormData) => Promise<SignupSubmissionState>;
  energyResolution?: WebsiteEnergyResolution | null;
  pricingPreview?: WebsitePricingPreview | null;
  estimatedMonthlyKwh?: number | null;
  contractDisplay?: PublicContractDisplay | null;
  quoteContext: WebsitePricingQuoteContext;
  quoteValid?: boolean;
  onEditQuote: () => void;
};

type FormValues = {
  customer_type: WebsiteCustomerType;
  selected_offer: string;
  first_name: string;
  last_name: string;
  personal_number: string;
  company_name: string;
  organization_number: string;
  company_signer_role: string;
  email: string;
  phone: string;
  invoice_email: string;
  billing_street: string;
  billing_postal_code: string;
  billing_city: string;
  billing_country: string;
  facility_id: string;
  metering_point_id: string;
  reading_frequency: string;
  measurement_type: string;
  installation_date: string;
  current_supplier_name: string;
  current_supplier_org_number: string;
  current_supplier_ediel_id: string;
  requested_start_mode: "earliest_possible" | "specific_date";
  requested_start_date: string;
};

type Consents = Record<string, boolean>;
type LegalBundleState = {
  status: "loading" | "ready" | "error";
  bundleVersion: string | null;
  supported: boolean;
  requirements: PublicLegalRequirement[];
  message: string | null;
};

const STEPS = ["Dina uppgifter", "Granska och teckna"];
function consumptionSourceLabel(profile: WebsiteConsumptionProfile | null | undefined): string {
  if (!profile) return "Angiven förbrukning";
  if (profile.source === "customer_entered") return "Angiven av kunden";
  return profile.customer_adjusted ? "Uppskattad och justerad av kunden" : "Uppskattad från bostadsuppgifter";
}


function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function Field({
  id,
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  help,
  error,
  autoComplete,
  inputMode,
  min,
}: {
  id: string;
  label: string;
  name: keyof FormValues;
  value: string;
  onChange: (name: keyof FormValues, value: string) => void;
  type?: string;
  required?: boolean;
  help?: string;
  error?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email";
  min?: string;
}) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-white/80">
        {label} {required ? <span className="text-cyan-300">*</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        min={min}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none transition focus:border-cyan-500/70 focus:ring-2 focus:ring-cyan-500/30"
      />
      {help ? <p id={helpId} className="mt-2 text-xs leading-5 text-white/45">{help}</p> : null}
      {error ? <p id={errorId} className="mt-2 text-xs leading-5 text-red-200">{error}</p> : null}
    </div>
  );
}

function ConsentCheckbox({
  id,
  name,
  checked,
  onChange,
  required = true,
  children,
}: {
  id: string;
  name: string;
  checked: boolean;
  onChange: (name: string, value: boolean) => void;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 text-sm leading-6 text-gray-300">
      <input
        id={id}
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(event) => onChange(name, event.target.checked)}
        required={required}
        className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40 focus:ring-2 focus:ring-cyan-500/40"
      />
      <span>{children}</span>
    </label>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={disabled || pending}
      className="h-12 rounded-2xl bg-cyan-500 px-8 font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
    >
      {pending ? "Tecknar..." : "Teckna elavtal"}
    </button>
  );
}

export default function CustomerApplicationForm({
  contracts,
  selectedValue,
  customerType,
  canSubmit,
  authenticatedEmail,
  utm,
  action,
  energyResolution,
  pricingPreview,
  estimatedMonthlyKwh,
  contractDisplay,
  quoteContext,
  quoteValid = true,
  onEditQuote,
}: Props) {
  const [step, setStep] = useState<0 | 1>(0);
  const [submissionAttemptId, setSubmissionAttemptId] = useState(() => crypto.randomUUID());
  const [companySignerAuthorized, setCompanySignerAuthorized] = useState(false);
  const [differentEmailConfirmed, setDifferentEmailConfirmed] = useState(false);
  const [billingSameAsContact, setBillingSameAsContact] = useState(true);
  const [currentSupplierUnknown, setCurrentSupplierUnknown] = useState(false);
  const [form, setForm] = useState<FormValues>({
    customer_type: customerType,
    selected_offer: selectedValue,
    first_name: "",
    last_name: "",
    personal_number: "",
    company_name: "",
    organization_number: "",
    company_signer_role: "",
    email: authenticatedEmail ?? "",
    phone: "",
    invoice_email: "",
    billing_street: "",
    billing_postal_code: "",
    billing_city: "",
    billing_country: "SE",
    facility_id: "",
    metering_point_id: "",
    reading_frequency: "",
    measurement_type: "",
    installation_date: "",
    current_supplier_name: "",
    current_supplier_org_number: "",
    current_supplier_ediel_id: "",
    requested_start_mode: quoteContext.requested_start_mode,
    requested_start_date: quoteContext.requested_start_date ?? "",
  });
  const [consents, setConsents] = useState<Consents>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionState, formAction] = useActionState(action, { errorMessage: null });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (submissionState.fieldErrors) setErrors(submissionState.fieldErrors);
      if (submissionState.step === 0 || submissionState.step === 1) setStep(submissionState.step);
      if (submissionState.rotateSubmissionAttempt) setSubmissionAttemptId(crypto.randomUUID());
      if (submissionState.requiresQuoteRefresh) onEditQuote();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [onEditQuote, submissionState]);

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.value === selectedValue) ?? null,
    [contracts, selectedValue],
  );
  const fallbackDisplay = useMemo(
    () => selectedContract ? buildPublicContractDisplay(signupContractOptionAsOpsContract(selectedContract)) : null,
    [selectedContract],
  );
  const activeDisplay = contractDisplay ?? fallbackDisplay;
  const legalBundle = useMemo<LegalBundleState>(() => {
    if (!selectedContract) {
      return {
        status: "error",
        bundleVersion: null,
        supported: false,
        requirements: [],
        message: "Valt avtal saknar juridiskt snapshot.",
      };
    }
    const bundleVersion =
      selectedContract.legal.legal_bundle_version_id ??
      selectedContract.legal.legal_bundle_reference;
    const requirements = selectedContract.legalRequirements ?? [];
    const unsupported = requirements.some((requirement) =>
      requirement.acceptance_type !== "checkbox" ||
      (requirement.required && !(
        requirement.label &&
        requirement.document_reference &&
        requirement.document_version &&
        requirement.document_hash &&
        requirement.public_url
      )),
    );
    const supported = Boolean(selectedContract.legal.immutable && bundleVersion && !unsupported);
    return {
      status: supported ? "ready" : "error",
      bundleVersion,
      supported,
      requirements,
      message: supported
        ? null
        : "Det publicerade avtalets låsta juridikunderlag är inte komplett för digital teckning.",
    };
  }, [selectedContract]);
  const legalRequirements = legalBundle.requirements;
  const legalReady = Boolean(
    activeDisplay?.onlineReady &&
    legalBundle.status === "ready" &&
    legalBundle.supported &&
    legalRequirements.every((requirement) =>
      !requirement.required || Boolean(
        requirement.label &&
        requirement.public_url &&
        requirement.document_reference &&
        requirement.document_version &&
        requirement.document_hash
      ),
    ),
  );

  useEffect(() => {
    setConsents({});
  }, [selectedContract?.offerReference]);
  const authenticatedEmailMismatch = Boolean(
    authenticatedEmail && form.email.trim() && authenticatedEmail.toLowerCase() !== form.email.trim().toLowerCase(),
  );
  const hasPricingPreview = Boolean(
    quoteValid &&
    pricingPreview?.pricing_token &&
    (pricingPreview.contract.offer_reference ?? pricingPreview.contract.slug) === selectedContract?.offerReference,
  );

  function rotateSubmissionAttempt() {
    setSubmissionAttemptId(crypto.randomUUID());
  }

  function updateField(name: keyof FormValues, value: string) {
    rotateSubmissionAttempt();
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    if (name === 'email') setDifferentEmailConfirmed(false);
  }

  function updateConsent(name: string, value: boolean) {
    rotateSubmissionAttempt();
    setConsents((current) => ({ ...current, [name]: value }));
  }

  function validateDetails(): boolean {
    const next: Record<string, string> = {};
    if (!selectedContract || !hasPricingPreview) next.pricing = "Räkna om priset innan du fortsätter.";
    if (!legalReady) next.legal = "Avtalets juridiska underlag är inte komplett. Välj ett annat avtal eller kontakta kundservice.";
    if (!form.first_name.trim()) next.first_name = customerType === 'business' ? "Ange firmatecknarens förnamn." : "Ange ditt förnamn.";
    if (!form.last_name.trim()) next.last_name = customerType === 'business' ? "Ange firmatecknarens efternamn." : "Ange ditt efternamn.";
    if (!isValidSwedishPersonalNumber(form.personal_number)) next.personal_number = "Ange ett giltigt svenskt personnummer med kontrollsiffra.";
    if (customerType === 'business') {
      if (!form.company_name.trim()) next.company_name = "Ange företagsnamn.";
      if (!isValidSwedishOrganizationNumber(form.organization_number)) next.organization_number = "Ange ett giltigt svenskt organisationsnummer.";
      if (!form.company_signer_role.trim()) next.company_signer_role = "Ange firmatecknarens roll eller befattning.";
      if (!companySignerAuthorized) next.company_signer_authorized = "Bekräfta att personen har rätt att företräda företaget.";
    }
    if (!isValidEmail(form.email)) next.email = "Ange en giltig e-postadress.";
    if (!normalizePhoneToE164(form.phone)) next.phone = "Ange ett giltigt telefonnummer.";
    if (authenticatedEmailMismatch && !differentEmailConfirmed) next.different_email_confirmed = "Bekräfta att teckningen ska göras med en annan e-post än kontot du är inloggad på.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function nextStep() {
    if (!validateDetails()) return;
    rotateSubmissionAttempt();
    setStep(1);
    window.requestAnimationFrame(() => document.getElementById('signup-review')?.focus());
  }

  const allConsentsAccepted = legalRequirements.every(
    (requirement) => !requirement.required || consents[requirement.requirement_code] === true,
  );
  const submitDisabled = !canSubmit || !allConsentsAccepted || !legalReady || !hasPricingPreview;
  const errorList = [...new Set(Object.values(errors))];
  const displayName = customerType === 'business'
    ? `${form.company_name} – ${form.first_name} ${form.last_name}`.trim()
    : `${form.first_name} ${form.last_name}`.trim();

  return (
    <div className="space-y-8" aria-live="polite">
      <ol className="grid gap-3 md:grid-cols-2" aria-label="Teckningssteg">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`rounded-2xl border p-4 text-sm ${index === step ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-100" : index < step ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-white/5 text-gray-400"}`}
          >
            <span className="font-semibold">Steg {index + 1}</span>
            <span className="mt-1 block">{label}</span>
          </li>
        ))}
      </ol>

      {errorList.length ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
          <div className="font-semibold">Kontrollera uppgifterna</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">{errorList.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      ) : null}

      {submissionState.errorMessage ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">
          {submissionState.errorMessage}
        </div>
      ) : null}

      {!quoteValid ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100" role="status">
          Prisberäkningen behöver hämtas på nytt ovan. Dina ifyllda kunduppgifter ligger kvar i den här fliken.
        </div>
      ) : null}

      {step === 0 ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white md:text-3xl">Dina uppgifter</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Pris, adress och avtal är redan verifierade. Fyll bara i uppgifterna som behövs för avtalet.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-5 text-sm text-cyan-50">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-semibold">{selectedContract?.name ?? 'Valt elavtal'}</div>
                <div className="mt-1 text-cyan-100/75">
                  {quoteContext.address}, {quoteContext.postal_code} {quoteContext.city} · {quoteContext.price_area_code} · {quoteContext.estimated_monthly_kwh.toLocaleString('sv-SE')} kWh/mån
                </div>
              </div>
              <button type="button" onClick={onEditQuote} className="text-left font-semibold text-cyan-200 underline underline-offset-4 sm:text-right">
                Ändra pris eller adress
              </button>
            </div>
          </div>

          {customerType === 'business' ? (
            <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div>
                <h3 className="font-semibold text-white">Företag och behörig firmatecknare</h3>
                <p className="mt-1 text-xs leading-5 text-gray-400">Fullmakten och signeringen kopplas till personen som faktiskt företräder företaget.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Field id="company_name" label="Företagsnamn" name="company_name" value={form.company_name} onChange={updateField} required error={errors.company_name} autoComplete="organization" />
                <Field id="organization_number" label="Organisationsnummer" name="organization_number" value={form.organization_number} onChange={updateField} required error={errors.organization_number} inputMode="numeric" help="10 siffror. Kontrollsiffran valideras." />
                <Field id="first_name" label="Firmatecknarens förnamn" name="first_name" value={form.first_name} onChange={updateField} required error={errors.first_name} autoComplete="given-name" />
                <Field id="last_name" label="Firmatecknarens efternamn" name="last_name" value={form.last_name} onChange={updateField} required error={errors.last_name} autoComplete="family-name" />
                <Field id="personal_number" label="Firmatecknarens personnummer" name="personal_number" value={form.personal_number} onChange={updateField} required error={errors.personal_number} inputMode="numeric" help="ÅÅÅÅMMDDNNNN. Samordningsnummer stöds." />
                <Field id="company_signer_role" label="Roll eller befattning" name="company_signer_role" value={form.company_signer_role} onChange={updateField} required error={errors.company_signer_role} help="Till exempel VD, styrelseledamot eller firmatecknare." />
              </div>
              <label className="flex items-start gap-3 text-sm leading-6 text-gray-300">
                <input type="checkbox" checked={companySignerAuthorized} onChange={(event) => { rotateSubmissionAttempt(); setCompanySignerAuthorized(event.target.checked); }} className="mt-1 h-4 w-4" />
                <span>Jag bekräftar att personen ovan har rätt att företräda företaget och ingå elavtalet.</span>
              </label>
              {errors.company_signer_authorized ? <p className="text-xs text-red-200">{errors.company_signer_authorized}</p> : null}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              <Field id="first_name" label="Förnamn" name="first_name" value={form.first_name} onChange={updateField} required error={errors.first_name} autoComplete="given-name" />
              <Field id="last_name" label="Efternamn" name="last_name" value={form.last_name} onChange={updateField} required error={errors.last_name} autoComplete="family-name" />
              <Field id="personal_number" label="Personnummer" name="personal_number" value={form.personal_number} onChange={updateField} required error={errors.personal_number} inputMode="numeric" help="ÅÅÅÅMMDDNNNN. Samordningsnummer stöds." />
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <Field id="email" label="E-post" name="email" value={form.email} onChange={updateField} type="email" required error={errors.email} autoComplete="email" inputMode="email" />
            <Field id="phone" label="Telefon" name="phone" value={form.phone} onChange={updateField} required error={errors.phone} autoComplete="tel" inputMode="tel" help="Svenska nummer normaliseras automatiskt till +46." />
          </div>

          <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div>
              <h3 className="font-semibold text-white">Fakturauppgifter</h3>
              <p className="mt-1 text-xs leading-5 text-gray-400">Faktureringsuppgifterna används bara om du väljer en annan adress eller e-post för fakturor.</p>
            </div>
            <label className="flex items-start gap-3 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={billingSameAsContact}
                onChange={(event) => {
                  rotateSubmissionAttempt();
                  setBillingSameAsContact(event.target.checked);
                }}
                className="mt-1 h-4 w-4"
              />
              <span>Använd kontaktens e-post och leveransadress för fakturering.</span>
            </label>
            {!billingSameAsContact ? (
              <div className="grid gap-5 md:grid-cols-2">
                <Field id="invoice_email" label="Faktura-e-post" name="invoice_email" value={form.invoice_email} onChange={updateField} type="email" autoComplete="email" inputMode="email" />
                <Field id="billing_street" label="Fakturaadress" name="billing_street" value={form.billing_street} onChange={updateField} autoComplete="street-address" />
                <Field id="billing_postal_code" label="Fakturapostnummer" name="billing_postal_code" value={form.billing_postal_code} onChange={updateField} inputMode="numeric" />
                <Field id="billing_city" label="Fakturaort" name="billing_city" value={form.billing_city} onChange={updateField} />
                <Field id="billing_country" label="Landkod" name="billing_country" value={form.billing_country} onChange={updateField} help="Två bokstäver, exempelvis SE." />
              </div>
            ) : null}
          </div>

          {authenticatedEmailMismatch ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <div className="font-semibold">Du är inloggad med {authenticatedEmail}</div>
              <p className="mt-1">Teckningen använder {form.email}. Den kopplas därför inte automatiskt till det inloggade kontot.</p>
              <label className="mt-3 flex items-start gap-3">
                <input type="checkbox" checked={differentEmailConfirmed} onChange={(event) => { rotateSubmissionAttempt(); setDifferentEmailConfirmed(event.target.checked); }} className="mt-1 h-4 w-4" />
                <span>Jag vill fortsätta med den andra e-postadressen.</span>
              </label>
              {errors.different_email_confirmed ? <p className="mt-2 text-xs text-red-200">{errors.different_email_confirmed}</p> : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <div className="text-sm font-semibold text-cyan-100">Startdatum låst i offerten</div>
            <p className="mt-2 text-sm text-cyan-50/80">
              {quoteContext.requested_start_mode === 'specific_date'
                ? `Valt startdatum: ${quoteContext.requested_start_date}`
                : `Så snart som möjligt (bekräftat startdatum: ${pricingPreview?.start_date ?? 'verifieras av Gridex'})`}
            </p>
            <p className="mt-2 text-xs leading-5 text-cyan-50/60">Ändra startvalet i prissteget för att skapa en ny signerad offert.</p>
          </div>

          <details className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <summary className="cursor-pointer font-semibold text-white">Jag har anläggnings- eller leverantörsuppgifter</summary>
            <p className="mt-2 text-xs leading-5 text-gray-400">Valfritt. Du kan fortsätta utan uppgifterna; med fullmakt kan Gridex verifiera dem med nätägaren.</p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Field id="facility_id" label="Anläggnings-ID" name="facility_id" value={form.facility_id} onChange={updateField} help="Finns ofta på nätfakturan. Mätpunkts-ID kompletteras efter verifiering." />
              <Field id="metering_point_id" label="Mätpunkts-ID" name="metering_point_id" value={form.metering_point_id} onChange={updateField} />
              <Field id="reading_frequency" label="Avläsningsfrekvens" name="reading_frequency" value={form.reading_frequency} onChange={updateField} help="Exempelvis monthly, hourly eller quarterly om du känner till den." />
              <Field id="measurement_type" label="Mättyp" name="measurement_type" value={form.measurement_type} onChange={updateField} />
              <Field id="installation_date" label="Installationsdatum" name="installation_date" value={form.installation_date} onChange={updateField} type="date" />
              <label className="flex items-start gap-3 text-sm text-gray-300 md:col-span-2">
                <input
                  type="checkbox"
                  checked={currentSupplierUnknown}
                  onChange={(event) => {
                    rotateSubmissionAttempt();
                    setCurrentSupplierUnknown(event.target.checked);
                    if (event.target.checked) {
                      setForm((current) => ({
                        ...current,
                        current_supplier_name: "",
                        current_supplier_org_number: "",
                        current_supplier_ediel_id: "",
                      }));
                    }
                  }}
                  className="mt-1 h-4 w-4"
                />
                <span>Jag känner inte till min nuvarande elleverantör.</span>
              </label>
              {!currentSupplierUnknown ? (
                <>
                  <Field id="current_supplier_name" label="Nuvarande elleverantör" name="current_supplier_name" value={form.current_supplier_name} onChange={updateField} />
                  <Field id="current_supplier_org_number" label="Leverantörens organisationsnummer" name="current_supplier_org_number" value={form.current_supplier_org_number} onChange={updateField} />
                  <Field id="current_supplier_ediel_id" label="Ediel-ID" name="current_supplier_ediel_id" value={form.current_supplier_ediel_id} onChange={updateField} />
                </>
              ) : null}
            </div>
          </details>

          <div className="flex justify-end">
            <button type="button" onClick={nextStep} disabled={!canSubmit} className="h-12 rounded-2xl bg-cyan-500 px-8 font-bold text-black disabled:opacity-60">Granska teckningen</button>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="company_website" value="" />
          <input type="hidden" name="submission_attempt_id" value={submissionAttemptId} />
          <input type="hidden" name="pricing_snapshot_token" value={pricingPreview?.pricing_token ?? ""} />
          <input type="hidden" name="pricing_snapshot_reference" value={pricingPreview?.pricing_snapshot_reference ?? ""} />
          <input type="hidden" name="energy_area_resolution_token" value={quoteContext.resolution_token ?? ""} />
          <input type="hidden" name="energy_area_resolution_id" value={quoteContext.resolution_id ?? ""} />
          <input type="hidden" name="legal_bundle_version" value={legalBundle.bundleVersion ?? ""} />
          <input type="hidden" name="company_signer_authorized" value={companySignerAuthorized ? "on" : ""} />
          <input type="hidden" name="different_email_confirmed" value={differentEmailConfirmed ? "on" : ""} />
          <input type="hidden" name="billing_same_as_contact" value={billingSameAsContact ? "on" : ""} />
          <input type="hidden" name="current_supplier_unknown" value={currentSupplierUnknown ? "on" : ""} />
          <input type="hidden" name="utm_source" value={utm.utm_source ?? ""} />
          <input type="hidden" name="utm_medium" value={utm.utm_medium ?? ""} />
          <input type="hidden" name="utm_campaign" value={utm.utm_campaign ?? ""} />
          {Object.entries(form).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
          <input type="hidden" name="address" value={quoteContext.address} />
          <input type="hidden" name="postal_code" value={quoteContext.postal_code} />
          <input type="hidden" name="city" value={quoteContext.city} />
          <input type="hidden" name="price_area_code" value={pricingPreview?.price_area_code ?? pricingPreview?.priceArea ?? energyResolution?.price_area_code ?? ""} />
          <input type="hidden" name="estimated_monthly_kwh" value={estimatedMonthlyKwh ?? pricingPreview?.kwh ?? ""} />
          <input type="hidden" name="annual_consumption_kwh" value={quoteContext.annual_consumption_kwh} />
          <input type="hidden" name="consumption_profile" value={quoteContext.consumption_profile ? JSON.stringify(quoteContext.consumption_profile) : ""} />
          <input type="hidden" name="pricing_preview_snapshot" value={pricingPreview ? JSON.stringify(pricingPreview) : ""} />
          <input type="hidden" name="contract_display_snapshot" value={activeDisplay ? JSON.stringify(activeDisplay.snapshot) : ""} />

          <section className="space-y-5">
            <div>
              <h2 id="signup-review" tabIndex={-1} className="text-2xl font-bold text-white md:text-3xl">Granska innan du tecknar</h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">Kontrollera avtal, pris, kontaktuppgifter och dokumentversioner.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
                <div className="text-base font-semibold text-white">Avtal och pris</div>
                <dl className="mt-4 space-y-3">
                  <ReviewRow label="Avtal" value={selectedContract?.name ?? 'Valt avtal'} />
                  <ReviewRow label="Typ" value={publicContractTypeLabel(selectedContract?.type)} />
                  {activeDisplay?.rows.map((row) => <ReviewRow key={row.key} label={row.label} value={row.formatted} />)}
                  <ReviewRow label="Elområde" value={quoteContext.price_area_code} />
                  <ReviewRow label={selectedContract?.energyDirection === "production" ? "Årsproduktion" : "Årsförbrukning"} value={`${(quoteContext.consumption_profile?.annual_kwh ?? quoteContext.estimated_monthly_kwh * 12).toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kWh/år`} />
                  <ReviewRow label={selectedContract?.energyDirection === "production" ? "Produktionsunderlag" : "Förbrukningsunderlag"} value={selectedContract?.energyDirection === "production" ? "Angiven årsproduktion" : consumptionSourceLabel(quoteContext.consumption_profile)} />
                  <ReviewRow label="Beräkningsvärde" value={`${quoteContext.estimated_monthly_kwh.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} kWh/mån`} />
                  {pricingPreview?.totalMonthlyCostInclVatSek != null ? <ReviewRow label="Beräknat inkl. moms" value={`${pricingPreview.totalMonthlyCostInclVatSek.toLocaleString('sv-SE', { maximumFractionDigits: 0 })} kr/mån`} /> : null}
                  {pricingPreview?.is_binding != null ? <ReviewRow label="Prisstatus" value={pricingPreview.is_binding ? 'Bindande offert' : 'Indikativ prisuppgift'} /> : null}
                  {pricingPreview?.source_period ? <ReviewRow label="Prisperiod" value={pricingPreview.source_period} /> : null}
                  {pricingPreview?.market_data_timestamp ? <ReviewRow label="Marknadsdata uppdaterad" value={new Date(pricingPreview.market_data_timestamp).toLocaleString('sv-SE')} /> : null}
                </dl>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-gray-300">
                <div className="text-base font-semibold text-white">Kund och start</div>
                <dl className="mt-4 space-y-3">
                  <ReviewRow label="Kundtyp" value={customerType === 'business' ? 'Företag' : 'Privatkund'} />
                  <ReviewRow label={customerType === 'business' ? 'Företag och firmatecknare' : 'Namn'} value={displayName} />
                  {customerType === 'business' ? <ReviewRow label="Roll" value={form.company_signer_role} /> : null}
                  <ReviewRow label="E-post" value={form.email} />
                  <ReviewRow label="Telefon" value={normalizePhoneToE164(form.phone) ?? form.phone} />
                  <ReviewRow label="Adress" value={`${quoteContext.address}, ${quoteContext.postal_code} ${quoteContext.city}`} />
                  <ReviewRow label="Start" value={quoteContext.requested_start_mode === 'specific_date' ? quoteContext.requested_start_date ?? pricingPreview?.start_date ?? '' : `Så snart som möjligt (${pricingPreview?.start_date ?? 'Gridex verifierar datum'})`} />
                </dl>
              </div>
            </div>

            {!legalReady ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                {legalBundle.message ?? "Avtalets dokumentlänkar är inte kompletta. Teckning är blockerad."}
              </div>
            ) : (
              <div className="space-y-4 rounded-3xl border border-white/10 bg-black/30 p-5">
                <div>
                  <div className="text-base font-semibold text-white">Villkor och godkännanden</div>
                  <p className="mt-1 text-sm leading-6 text-gray-400">Varje länk är den exakta publicerade version som binds till avtalet.</p>
                </div>
                {legalRequirements.map((requirement) => (
                  <ConsentCheckbox
                    key={requirement.requirement_code}
                    id={`legal-${requirement.requirement_code}`}
                    name={`legal_acceptance:${requirement.requirement_code}`}
                    checked={consents[requirement.requirement_code] === true}
                    required={requirement.required}
                    onChange={(_, value) => updateConsent(requirement.requirement_code, value)}
                  >
                    {requirement.label}{' '}
                    {requirement.public_url ? <LegalLink href={requirement.public_url}>Öppna dokument</LegalLink> : null}
                  </ConsentCheckbox>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
            <button type="button" onClick={() => { setErrors({}); setStep(0); }} className="h-12 rounded-2xl border border-white/10 px-6 text-sm font-semibold text-white">Tillbaka</button>
            <div className="text-sm text-gray-400">Avtalet registreras som signerat när de låsta dokumentversionerna har verifierats.</div>
            <SubmitButton disabled={submitDisabled} />
          </div>
        </form>
      ) : null}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-gray-500">{label}</dt><dd className="text-right text-white">{value}</dd></div>;
}

function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="text-cyan-300 underline underline-offset-4 hover:text-cyan-200" target="_blank" rel="noreferrer">{children}</Link>;
}
