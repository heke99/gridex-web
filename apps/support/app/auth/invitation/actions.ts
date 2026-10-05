"use server";
import { redirect } from "next/navigation";
import type { FormState } from "@/support/components/ActionForm";
import { submitSupportInvitation } from "@/support/lib/invitation";

export async function acceptInvitation(
  _previous: FormState,
  data: FormData,
): Promise<FormState> {
  const result = await submitSupportInvitation(data);
  if (result.error) return result;
  redirect("/");
}
