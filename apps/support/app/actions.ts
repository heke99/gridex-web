"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSupportSession } from "@/support/lib/session";
import { StaffApiError } from "@/staff-api/client";
import type { FormState } from "@/support/components/ActionForm";
import type {
  StaffStatusRequest,
  StaffPhoneRequest,
  StaffContactChangeRequest,
} from "@/staff-api/types";

function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}
export async function createCase(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const { api } = await requireSupportSession();
  let reference: string;
  try {
    const result = await api.createCase(
      {
        customer_reference: text(data, "customer_reference"),
        title: text(data, "title"),
        description: text(data, "description") || null,
        priority: text(data, "priority") as
          | "low"
          | "normal"
          | "high"
          | "urgent",
      },
      text(data, "idempotency_key"),
    );
    reference = result.data.case_reference;
  } catch (error) {
    if (error instanceof StaffApiError) return { error: error.message };
    throw error;
  }
  revalidatePath("/");
  redirect(`/cases/${reference}`);
}
export async function caseCommand(
  reference: string,
  command: "reply" | "note" | "phone" | "status" | "assignee",
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const { api } = await requireSupportSession();
  const key = text(data, "idempotency_key");
  try {
    switch (command) {
      case "reply":
        await api.reply(reference, { message: text(data, "message") }, key);
        break;
      case "note":
        await api.addNote(reference, { message: text(data, "message") }, key);
        break;
      case "phone":
        await api.logPhone(
          reference,
          {
            direction: text(
              data,
              "direction",
            ) as StaffPhoneRequest["direction"],
            summary: text(data, "summary"),
            verification_method: text(
              data,
              "verification_method",
            ) as StaffPhoneRequest["verification_method"],
            verification_reference:
              text(data, "verification_reference") || null,
          },
          key,
        );
        break;
      case "status":
        await api.setStatus(
          reference,
          { status: text(data, "status") as StaffStatusRequest["status"] },
          key,
        );
        break;
      case "assignee":
        await api.setAssignee(
          reference,
          { assignee_user_id: text(data, "assignee_user_id") || null },
          key,
        );
        break;
      default:
        return { error: "Åtgärden stöds inte." };
    }
  } catch (error) {
    if (error instanceof StaffApiError) return { error: error.message };
    throw error;
  }
  revalidatePath("/");
  revalidatePath(`/cases/${reference}`);
  return { success: "Ändringen är sparad." };
}
export async function customerContact(
  reference: string,
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const { api } = await requireSupportSession();
  try {
    const field = text(data, "field");
    if (
      ![
        "email",
        "phone",
        "invoice_email",
        "preferred_language",
        "apartment_number",
      ].includes(field)
    )
      return { error: "Kontaktuppgiften stöds inte." };
    const payload = {
      expectedUpdatedAt: text(data, "expected_updated_at"),
      [field]: text(data, "value"),
    } as StaffContactChangeRequest;
    await api.updateContact(reference, payload, text(data, "idempotency_key"));
  } catch (error) {
    if (error instanceof StaffApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/customers/${reference}`);
  return { success: "Kontaktuppgiften är sparad." };
}
export async function inviteUser(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const { api } = await requireSupportSession();
  try {
    await api.inviteUser(
      {
        email: text(data, "email"),
        full_name: text(data, "full_name") || null,
        role_key: text(data, "role_key"),
      },
      text(data, "idempotency_key"),
    );
  } catch (error) {
    if (error instanceof StaffApiError) return { error: error.message };
    throw error;
  }
  revalidatePath("/team");
  return { success: "Inbjudan är registrerad." };
}
export async function userCommand(
  userId: string,
  command: "role" | "disable" | "enable",
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const { api } = await requireSupportSession();
  try {
    const key = text(data, "idempotency_key");
    if (command === "role")
      await api.changeUserRole(
        userId,
        { role_key: text(data, "role_key") },
        key,
      );
    else if (command === "disable")
      await api.disableUser(
        userId,
        { reason: text(data, "reason") || null },
        key,
      );
    else if (command === "enable") await api.enableUser(userId, key);
    else return { error: "Åtgärden stöds inte." };
  } catch (error) {
    if (error instanceof StaffApiError) return { error: error.message };
    throw error;
  }
  revalidatePath("/team");
  return { success: "Personaluppgiften är sparad." };
}
