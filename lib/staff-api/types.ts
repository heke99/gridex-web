/** Staff DTOs derive from the synchronized OpenAPI; local helpers preserve stricter form constraints. */
import type { components } from '../ops/generated/staff-api'
import type { SupportedResponseVersion } from '../ops/responseProfiles'
import { GRIDEX_API_CONTRACT_VERSION } from '../ops/contract'
type StaffSchema<K extends keyof components['schemas']> = components['schemas'][K] extends { contract_schema_version: string }
  ? Omit<components['schemas'][K], 'contract_schema_version'> & { contract_schema_version: SupportedResponseVersion }
  : components['schemas'][K]

export const STAFF_CONTRACT_VERSION = GRIDEX_API_CONTRACT_VERSION

export type OpenApiReleaseManifest = StaffSchema<'OpenApiReleaseManifest'>

export type OpenApiReleaseSpecification = StaffSchema<'OpenApiReleaseSpecification'>

export type ErrorResponse = StaffSchema<'ErrorResponse'>

export type ApiBlocker = StaffSchema<'ApiBlocker'>

export type StaffAccount = StaffSchema<'StaffAccount'>

export type StaffAccountState = StaffSchema<'StaffAccountState'>

export type StaffInviteResult = StaffSchema<'StaffInviteResult'>

export type StaffRole = StaffSchema<'StaffRole'>

export type StaffInviteRequest = StaffSchema<'StaffInviteRequest'>

export type StaffRoleChangeRequest = StaffSchema<'StaffRoleChangeRequest'>

export type StaffDisableRequest = StaffSchema<'StaffDisableRequest'>

export type StaffPagination = StaffSchema<'StaffPagination'>

export type StaffCustomerSummary = StaffSchema<'StaffCustomerSummary'>

export type StaffCustomerContact = StaffSchema<'StaffCustomerContact'>

export type StaffCustomerAddress = StaffSchema<'StaffCustomerAddress'>

export type StaffCustomerSite = StaffSchema<'StaffCustomerSite'>

export type StaffCustomer = StaffSchema<'StaffCustomer'>

export type StaffCustomerPagination = StaffSchema<'StaffCustomerPagination'>

type StaffContactFields = { email?: string | null; phone?: string | null; invoice_email?: string | null; preferred_language?: string | null; apartment_number?: string | null }
type StaffAtLeastOneContact = { [K in keyof StaffContactFields]-?: Required<Pick<StaffContactFields, K>> & Omit<StaffContactFields, K> }[keyof StaffContactFields]
export type StaffContactChangeRequest = { expectedUpdatedAt: string } & StaffAtLeastOneContact

export type StaffContactChangeResult = StaffSchema<'StaffContactChangeResult'>

export type StaffIdentityChangeRequest = StaffSchema<'StaffIdentityChangeRequest'>

export type StaffIdentityChangeResult = StaffSchema<'StaffIdentityChangeResult'>

export type StaffCase = StaffSchema<'StaffCase'>

export type StaffCaseDetail = StaffSchema<'StaffCaseDetail'>

export type StaffCaseEvent = StaffSchema<'StaffCaseEvent'>

export type StaffCaseCreateRequest = StaffSchema<'StaffCaseCreateRequest'>

export type StaffMessageRequest = StaffSchema<'StaffMessageRequest'>

export type StaffNoteRequest = StaffSchema<'StaffNoteRequest'>

export type StaffPhoneRequest = StaffSchema<'StaffPhoneRequest'>

export type StaffStatusRequest = StaffSchema<'StaffStatusRequest'>

export type StaffAssigneeRequest = StaffSchema<'StaffAssigneeRequest'>

export type StaffAttachment = StaffSchema<'StaffAttachment'>

export type getApiV1StaffUsersResponse = StaffSchema<'getApiV1StaffUsersResponse'>

export type postApiV1StaffUsersResponse = StaffSchema<'postApiV1StaffUsersResponse'>

export type patchApiV1StaffUsersIdResponse = StaffSchema<'patchApiV1StaffUsersIdResponse'>

export type postApiV1StaffUsersIdDisableResponse = StaffSchema<'postApiV1StaffUsersIdDisableResponse'>

export type postApiV1StaffUsersIdEnableResponse = StaffSchema<'postApiV1StaffUsersIdEnableResponse'>

export type getApiV1StaffRolesResponse = StaffSchema<'getApiV1StaffRolesResponse'>

export type getApiV1StaffCustomersResponse = StaffSchema<'getApiV1StaffCustomersResponse'>

export type getApiV1StaffCustomersRefResponse = StaffSchema<'getApiV1StaffCustomersRefResponse'>

export type patchApiV1StaffCustomersRefContactResponse = StaffSchema<'patchApiV1StaffCustomersRefContactResponse'>

export type postApiV1StaffCustomersRefIdentityChangeResponse = StaffSchema<'postApiV1StaffCustomersRefIdentityChangeResponse'>

export type getApiV1StaffCasesResponse = StaffSchema<'getApiV1StaffCasesResponse'>

export type postApiV1StaffCasesResponse = StaffSchema<'postApiV1StaffCasesResponse'>

export type getApiV1StaffCasesReferenceResponse = StaffSchema<'getApiV1StaffCasesReferenceResponse'>

export type postApiV1StaffCasesReferenceMessagesResponse = StaffSchema<'postApiV1StaffCasesReferenceMessagesResponse'>

export type postApiV1StaffCasesReferenceNotesResponse = StaffSchema<'postApiV1StaffCasesReferenceNotesResponse'>

export type postApiV1StaffCasesReferencePhoneInteractionsResponse = StaffSchema<'postApiV1StaffCasesReferencePhoneInteractionsResponse'>

export type patchApiV1StaffCasesReferenceStatusResponse = StaffSchema<'patchApiV1StaffCasesReferenceStatusResponse'>

export type patchApiV1StaffCasesReferenceAssigneeResponse = StaffSchema<'patchApiV1StaffCasesReferenceAssigneeResponse'>

export type getApiV1StaffCasesReferenceAttachmentsResponse = StaffSchema<'getApiV1StaffCasesReferenceAttachmentsResponse'>

export type postApiV1StaffCasesReferenceAttachmentsResponse = StaffSchema<'postApiV1StaffCasesReferenceAttachmentsResponse'>

export type getApiV1StaffCasesReferenceAttachmentsAttachmentReferenceFileResponse = StaffSchema<'getApiV1StaffCasesReferenceAttachmentsAttachmentReferenceFileResponse'>

export type StaffCasePage = StaffSchema<'StaffCasePage'>

export type StaffEnableRequest = StaffSchema<'StaffEnableRequest'>

export type ErrorEnvelope = StaffSchema<'ErrorEnvelope'>

export type StaffEmbeddedCollectionPage = StaffSchema<'StaffEmbeddedCollectionPage'>

export type getApiV1StaffCasesReferenceEventsResponse = StaffSchema<'getApiV1StaffCasesReferenceEventsResponse'>

export type StaffCaseStatus = StaffCase['status']
export type StaffMutableStatus = StaffStatusRequest['status']
export type StaffCursorQuery = { limit?: number; cursor?: string | null }
export type StaffCaseQuery = StaffCursorQuery & { status?: StaffCaseStatus; customer_reference?: string; query?: string }
export type StaffUserQuery = { page?: number; page_size?: number; status?: 'active' | 'disabled' | 'removed' | 'invited' | 'pending' | 'suspended' | 'removed_from_company' | 'invitation_revoked' | 'locked_security' | 'revoked' }
export type StaffCustomerQuery = { q?: string; page?: number; page_size?: number; status?: 'all' | 'draft' | 'pending_verification' | 'active' | 'inactive' | 'moved' | 'terminated' | 'blocked' | 'archived'; customer_type?: 'all' | 'private' | 'business' }
export type StaffDownloadedAttachment = { bytes: Uint8Array; mimeType: 'application/pdf' | 'image/png' | 'image/jpeg'; sha256: string; requestId: string | null; contentDisposition: string | null }
