import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { STAFF_SUBJECT_UUID } from "../../../lib/staff-api/config";
import { SUPPORT_AUTH_URL } from "./auth-config";
import { requireSupportSession, type SupportSession } from "./session";

export const PUBLIC_INQUIRY_SOURCE = "public_kundservice_form" as const;
export const PUBLIC_INQUIRY_STATUSES = [
  "open",
  "waiting_on_customer",
  "waiting_on_internal",
  "resolved",
  "closed",
] as const;
export type PublicInquiryStatus = (typeof PUBLIC_INQUIRY_STATUSES)[number];
export const PUBLIC_INQUIRY_LABELS: Record<PublicInquiryStatus, string> = {
  open: "Ny",
  waiting_on_customer: "Väntar på kontakt",
  waiting_on_internal: "Under handläggning",
  resolved: "Hanterad",
  closed: "Stängd",
};
export type PublicInquiry = {
  id: string;
  subject: string;
  description: string;
  category: string;
  status: PublicInquiryStatus;
  createdAt: string;
  updatedAt: string;
  contact: { name: string | null; email: string | null; phone: string | null };
};
type InquiryRow = {
  id: string;
  user_id: string | null;
  subject: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};
export class PublicInquiryError extends Error {
  readonly code: "public_inquiry_invalid" | "public_inquiry_unavailable";
  constructor(code: "public_inquiry_invalid" | "public_inquiry_unavailable") {
    super(
      code === "public_inquiry_invalid"
        ? "Kontaktförfrågan är ogiltig."
        : "Kontaktförfrågningarna kunde inte hämtas. Försök igen senare.",
    );
    this.name = "PublicInquiryError";
    this.code = code;
  }
}
const COLUMNS =
  "id,user_id,subject,description,category,status,created_at,updated_at,metadata";
export function readPublicInquiryServiceKey(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const key = environment.GRIDEX_SUPPORT_SUPABASE_SERVICE_KEY?.trim() ?? "";
  if (/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(key)) return key;
  try {
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key))
      throw new Error();
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1], "base64url").toString("utf8"),
    );
    if (
      payload.role === "service_role" &&
      payload.ref === "ayiuxjlfazkjmmtlvhsl"
    )
      return key;
  } catch {
    /* Configuration validation only; Supabase verifies the credential. */
  }
  throw new PublicInquiryError("public_inquiry_unavailable");
}
function visibleRow(value: unknown): PublicInquiry {
  const row = value as InquiryRow | null;
  if (
    !row ||
    !STAFF_SUBJECT_UUID.test(row.id) ||
    row.user_id !== null ||
    !row.metadata ||
    row.metadata.source !== PUBLIC_INQUIRY_SOURCE ||
    typeof row.subject !== "string" ||
    typeof row.description !== "string" ||
    typeof row.category !== "string" ||
    !PUBLIC_INQUIRY_STATUSES.some((status) => status === row.status) ||
    !Number.isFinite(Date.parse(row.created_at)) ||
    !Number.isFinite(Date.parse(row.updated_at))
  )
    throw new PublicInquiryError("public_inquiry_unavailable");
  const incoming = (field: string, maximum: number) =>
    typeof row.metadata[field] === "string"
      ? String(row.metadata[field]).slice(0, maximum)
      : null;
  return {
    id: row.id,
    subject: row.subject,
    description: row.description,
    category: row.category,
    status: row.status as PublicInquiryStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contact: {
      name: incoming("customer_name", 120),
      email: incoming("customer_email", 180),
      phone: incoming("customer_phone", 60),
    },
  };
}
export function createPublicInquiryReader(dependencies: {
  requireSession: () => Promise<SupportSession>;
  service: () => SupabaseClient;
}) {
  return {
    list: async (input: { page?: number; status?: string } = {}) => {
      await dependencies.requireSession();
      const page = input.page ?? 1;
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > 10000 ||
        (input.status &&
          !PUBLIC_INQUIRY_STATUSES.some((value) => value === input.status))
      )
        throw new PublicInquiryError("public_inquiry_invalid");
      let query = dependencies
        .service()
        .from("customer_support_tickets")
        .select(COLUMNS, { count: "exact" })
        .is("user_id", null)
        .eq("metadata->>source", PUBLIC_INQUIRY_SOURCE);
      if (input.status) query = query.eq("status", input.status);
      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range((page - 1) * 25, page * 25 - 1);
      if (error || !Array.isArray(data) || typeof count !== "number")
        throw new PublicInquiryError("public_inquiry_unavailable");
      return {
        items: data.map(visibleRow),
        page,
        total: count,
        totalPages: Math.ceil(count / 25),
      };
    },
    detail: async (id: string) => {
      await dependencies.requireSession();
      if (!STAFF_SUBJECT_UUID.test(id))
        throw new PublicInquiryError("public_inquiry_invalid");
      const { data, error } = await dependencies
        .service()
        .from("customer_support_tickets")
        .select(COLUMNS)
        .is("user_id", null)
        .eq("metadata->>source", PUBLIC_INQUIRY_SOURCE)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new PublicInquiryError("public_inquiry_unavailable");
      return data ? visibleRow(data) : null;
    },
  };
}
export const publicInquiries = createPublicInquiryReader({
  requireSession: requireSupportSession,
  service: () =>
    createClient(SUPPORT_AUTH_URL, readPublicInquiryServiceKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
});
