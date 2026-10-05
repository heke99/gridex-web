import { requireSupportSession } from "@/support/lib/session";
import { StaffApiError } from "@/staff-api/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string; attachment: string }> },
) {
  const { api } = await requireSupportSession();
  const { reference, attachment } = await params;
  try {
    const file = await api.downloadAttachment(reference, attachment);
    return new Response(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": file.contentDisposition ?? "attachment",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof StaffApiError)
      return new Response(error.message, {
        status: error.status,
        headers: { "Cache-Control": "no-store" },
      });
    throw error;
  }
}
