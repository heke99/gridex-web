export const STATUS: Record<string, string> = {
  open: "Öppet",
  action_required: "Kräver åtgärd",
  awaiting_external_response: "Väntar på svar",
  billing_blocked: "Fakturering blockerad",
  manual_follow_up: "Uppföljning",
  resolved: "Löst",
  cancelled: "Avbrutet",
  closed: "Stängt",
};
export const PRIORITY: Record<string, string> = {
  low: "Låg",
  normal: "Normal",
  high: "Hög",
  urgent: "Akut",
};
export const WRITE_STATUSES = [
  "open",
  "action_required",
  "awaiting_external_response",
  "manual_follow_up",
  "resolved",
  "closed",
] as const;
export function date(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("sv-SE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Stockholm",
      }).format(new Date(value))
    : "—";
}
export function pageNumber(value: string | undefined) {
  return value && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
}
