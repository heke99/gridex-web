// Types copied from the immutable staff API 2026-10-04.1 schema.
// Source SHA-256: 460cf343a397c99f1173482ceb4c0045828399172fd47dd8c078e7d611e16de7
export const STAFF_CONTRACT_VERSION = '2026-10-04.1' as const

export type OpenApiReleaseManifest = { "release_version": "2026-10-04.1"; "website_openapi_version": "2026-10-04.1"; "customer_portal_openapi_version": "2026-10-04.1"; "staff_openapi_version": "2026-10-04.1"; "runtime_contract_version": "2026-10-04.1"; "guide_version": "2026-10-04.1"; "released_at": string; "generated_at": string; "build_commit": string; "compatibility_classification": "backward-compatible" | "breaking-client-update-required" | "breaking"; "deprecated_features": Array<{ "feature": string; "replacement": string; "sunset_at": string }>; "minimum_tenant_integration_version": "2026-10-02.3"; "specifications": { "website": OpenApiReleaseSpecification; "customer_portal": OpenApiReleaseSpecification; "staff": OpenApiReleaseSpecification } }

export type OpenApiReleaseSpecification = { "contract_name": string; "contract_version": "2026-10-04.1"; "url": string; "immutable_url": string; "sha256": string; "compatibility": "backward-compatible" | "breaking-client-update-required" | "breaking" }

export type ErrorResponse = { "error": { "code": string; "message": string; "stage"?: string; "field": string | null; "hint"?: string; "retryable": boolean; "blockers": Array<ApiBlocker>; "details"?: Record<string, unknown> | Array<unknown> | string | number | boolean | null }; "request_id": string; "correlation_id": string; "contract_schema_version": "2026-10-04.1" }

export type ApiBlocker = { "code": string; "message": string; "field"?: string | null; "resource_type"?: string | null; "resource_id"?: string | null; "count"?: number | null; "recommended_action"?: string | null; "metadata"?: { [key: string]: unknown } | null }

export type StaffAccount = { "user_id": string; "email": string | null; "full_name": string | null; "role_key": string; "membership_role": string; "status": string; "invited_at": string | null; "accepted_at": string | null; "disabled_at": string | null }

export type StaffAccountState = { "user_id": string; "role_key": string; "membership_role": string; "status": string }

export type StaffInviteResult = { "email": string; "role_key": string; "membership_role": string; "status": "pending" }

export type StaffRole = { "key": string; "label": string; "description": string; "permissions": Array<string>; "assignable": boolean }

export type StaffInviteRequest = { "email": string; "full_name"?: string | null; "role_key": string }

export type StaffRoleChangeRequest = { "role_key": string }

export type StaffDisableRequest = { "reason"?: string | null }

export type StaffPagination = { "page": number; "page_size": number; "total": number; "has_more": boolean }

export type StaffCustomerSummary = { "customer_reference": string; "customer_number": string | null; "customer_type": string | null; "status": string | null; "display_name": string | null; "first_name": string | null; "last_name": string | null; "company_name": string | null; "email": string | null; "phone": string | null; "personal_number_masked": string | null; "org_number_masked": string | null; "created_at": string | null }

export type StaffCustomerContact = { "contact_reference": string; "type": string | null; "name": string | null; "email": string | null; "phone": string | null; "title": string | null; "is_primary": boolean }

export type StaffCustomerAddress = { "address_reference": string; "type": string | null; "street_1": string | null; "street_2": string | null; "postal_code": string | null; "city": string | null; "country": string | null; "is_active": boolean }

export type StaffCustomerSite = { "facility_reference": string; "site_name": string | null; "facility_id": string | null; "site_type": string | null; "status": string | null; "price_area_code": string | null; "street": string | null; "postal_code": string | null; "city": string | null }

export type StaffCustomer = { "customer_reference": string; "customer_number": string | null; "customer_type": string | null; "status": string | null; "display_name": string | null; "first_name": string | null; "last_name": string | null; "company_name": string | null; "email": string | null; "phone": string | null; "personal_number_masked": string | null; "org_number_masked": string | null; "created_at": string | null; "invoice_email": string | null; "preferred_language": string | null; "apartment_number": string | null; "updated_at": string | null; "contacts": Array<StaffCustomerContact>; "addresses": Array<StaffCustomerAddress>; "sites": Array<StaffCustomerSite>; "contacts_page": StaffEmbeddedCollectionPage; "addresses_page": StaffEmbeddedCollectionPage; "sites_page": StaffEmbeddedCollectionPage }

export type StaffCustomerPagination = { "page": number; "page_size": number; "total": number; "total_pages": number }

type StaffContactFields = { email?: string | null; phone?: string | null; invoice_email?: string | null; preferred_language?: string | null; apartment_number?: string | null }
type StaffAtLeastOneContact = { [K in keyof StaffContactFields]-?: Required<Pick<StaffContactFields, K>> & Omit<StaffContactFields, K> }[keyof StaffContactFields]
export type StaffContactChangeRequest = { expectedUpdatedAt: string } & StaffAtLeastOneContact

export type StaffContactChangeResult = { "customer_reference": string; "changed": boolean; "customer_updated_at": string | null }

export type StaffIdentityChangeRequest = { "field": "personal_number" | "org_number"; "new_value": string; "reason": string }

export type StaffIdentityChangeResult = { "request_reference": string; "status": "applied" | "pending_customer_approval"; "recipient_masked": string | null; "expires_at": string | null; "contract_count": number | null; "takeover_required": boolean | null }

export type StaffCase = { "case_reference": string; "customer_reference": string; "title": string; "description": string | null; "status": "open" | "action_required" | "awaiting_external_response" | "billing_blocked" | "manual_follow_up" | "resolved" | "cancelled" | "closed"; "priority": string; "category": string | null; "assignee_user_id": string | null; "channel": string | null; "created_at": string; "updated_at": string; "resolved_at": string | null; "closed_at": string | null }

export type StaffCaseDetail = { "case_reference": string; "customer_reference": string; "title": string; "description": string | null; "status": "open" | "action_required" | "awaiting_external_response" | "billing_blocked" | "manual_follow_up" | "resolved" | "cancelled" | "closed"; "priority": string; "category": string | null; "assignee_user_id": string | null; "channel": string | null; "created_at": string; "updated_at": string; "resolved_at": string | null; "closed_at": string | null; "events": Array<StaffCaseEvent>; "attachments": Array<StaffAttachment>; "events_page": StaffCasePage; "attachments_page": StaffCasePage }

export type StaffCaseEvent = { "event_reference": string; "event_type": string; "message": string | null; "visibility": "customer" | "internal"; "author_type": "customer" | "staff"; "author_user_id": string | null; "channel": string | null; "kind": "message" | "phone_summary" | null; "direction": string | null; "verification_method": string | null; "verification_reference": string | null; "representative": { "name": string | null; "mandate_reference": string | null } | null; "created_at": string }

export type StaffCaseCreateRequest = { "customer_reference": string; "title": string; "description"?: string | null; "category"?: string | null; "priority"?: "low" | "normal" | "high" | "urgent" }

export type StaffMessageRequest = { "message": string; "kind"?: "message" | "phone_summary" }

export type StaffNoteRequest = { "message": string }

export type StaffPhoneRequest = { "direction": "inbound" | "outbound"; "summary": string; "verification_method": "unverified" | "strong_eid" | "authenticated_portal_confirmation" | "callback_registered_number"; "verification_reference"?: string | null; "representative"?: { "name"?: string | null; "mandate_reference"?: string | null } | null }

export type StaffStatusRequest = { "status": "open" | "action_required" | "awaiting_external_response" | "manual_follow_up" | "resolved" | "closed"; "message"?: string | null }

export type StaffAssigneeRequest = { "assignee_user_id": string | null }

export type StaffAttachment = { "attachment_reference": string; "file_name": string; "mime_type": "application/pdf" | "image/png" | "image/jpeg" | null; "byte_size": number; "sha256": string; "uploaded_by": "customer" | "staff"; "created_at": string; "visibility": "customer" | "internal"; "scan_status": "quarantined" | "released" | "rejected"; "scan_reason": string | null }

export type getApiV1StaffUsersResponse = { "data": Array<StaffAccount>; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1"; "pagination": StaffPagination }

export type postApiV1StaffUsersResponse = { "data": StaffInviteResult; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type patchApiV1StaffUsersIdResponse = { "data": StaffAccountState; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type postApiV1StaffUsersIdDisableResponse = { "data": StaffAccountState; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type postApiV1StaffUsersIdEnableResponse = { "data": StaffAccountState; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type getApiV1StaffRolesResponse = { "data": Array<StaffRole>; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type getApiV1StaffCustomersResponse = { "data": { "customers": Array<StaffCustomerSummary>; "pagination": StaffCustomerPagination }; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type getApiV1StaffCustomersRefResponse = { "data": { "customer": StaffCustomer }; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type patchApiV1StaffCustomersRefContactResponse = { "data": StaffContactChangeResult; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type postApiV1StaffCustomersRefIdentityChangeResponse = { "data": StaffIdentityChangeResult; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type getApiV1StaffCasesResponse = { "data": Array<StaffCase>; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1"; "page": StaffCasePage }

export type postApiV1StaffCasesResponse = { "data": StaffCase; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type getApiV1StaffCasesReferenceResponse = { "data": StaffCaseDetail; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type postApiV1StaffCasesReferenceMessagesResponse = { "data": StaffCaseEvent; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type postApiV1StaffCasesReferenceNotesResponse = { "data": StaffCaseEvent; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type postApiV1StaffCasesReferencePhoneInteractionsResponse = { "data": StaffCaseEvent; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type patchApiV1StaffCasesReferenceStatusResponse = { "data": StaffCase; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type patchApiV1StaffCasesReferenceAssigneeResponse = { "data": StaffCase; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type getApiV1StaffCasesReferenceAttachmentsResponse = { "data": Array<StaffAttachment>; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1"; "page": StaffCasePage }

export type postApiV1StaffCasesReferenceAttachmentsResponse = { "data": StaffAttachment; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type getApiV1StaffCasesReferenceAttachmentsAttachmentReferenceFileResponse = { "data": unknown; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1" }

export type StaffCasePage = { "limit": number; "offset": 0; "returned": number; "has_more": boolean; "next_cursor": string | null }

export type StaffEnableRequest = Record<string, unknown>

export type ErrorEnvelope = { "error": { "code": string; "message": string; "stage"?: string; "field": string | null; "hint"?: string; "retryable": boolean; "blockers": Array<ApiBlocker>; "details"?: Record<string, unknown> | Array<unknown> | string | number | boolean | null }; "request_id": string; "correlation_id": string; "contract_schema_version": "2026-10-04.1" }

export type StaffEmbeddedCollectionPage = { "limit": 100; "returned": number; "has_more": boolean }

export type getApiV1StaffCasesReferenceEventsResponse = { "data": Array<StaffCaseEvent>; "request_id": string; "correlation_id"?: string | null; "contract_schema_version": "2026-10-04.1"; "page": StaffCasePage }

export type StaffCaseStatus = StaffCase['status']
export type StaffMutableStatus = StaffStatusRequest['status']
export type StaffCursorQuery = { limit?: number; cursor?: string | null }
export type StaffCaseQuery = StaffCursorQuery & { status?: StaffCaseStatus; customer_reference?: string; query?: string }
export type StaffUserQuery = { page?: number; page_size?: number; status?: 'active' | 'disabled' | 'removed' | 'invited' | 'pending' | 'suspended' | 'removed_from_company' | 'invitation_revoked' | 'locked_security' | 'revoked' }
export type StaffCustomerQuery = { q?: string; page?: number; page_size?: number; status?: 'all' | 'draft' | 'pending_verification' | 'active' | 'inactive' | 'moved' | 'terminated' | 'blocked' | 'archived'; customer_type?: 'all' | 'private' | 'business' }
export type StaffDownloadedAttachment = { bytes: Uint8Array; mimeType: 'application/pdf' | 'image/png' | 'image/jpeg'; sha256: string; requestId: string | null; contentDisposition: string | null }
