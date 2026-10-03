export type SupportCase = {
  case_reference: string
  title: string
  description: string | null
  status: 'received' | 'in_progress' | 'resolved' | 'closed'
  channel: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
}

export type SupportMessage = {
  message_reference: string
  author_type: 'customer' | 'staff'
  kind: 'message' | 'phone_summary'
  body: string
  created_at: string
}

export type SupportCaseDetail = SupportCase & { messages: SupportMessage[] }

export type SupportAttachment = {
  attachment_reference: string
  file_name: string
  mime_type: 'application/pdf' | 'image/png' | 'image/jpeg'
  byte_size: number
  sha256: string
  uploaded_by: 'customer' | 'staff'
  created_at: string
}

export type SupportPage = {
  limit: number
  offset: number
  returned: number
  has_more: boolean
  next_cursor: string | null
}

export type SupportResponse<T> = {
  data: T
  request_id: string
  contract_schema_version: string
  correlation_id?: string | null
}

export type SupportListResponse = SupportResponse<SupportCase[]> & { page: SupportPage }

export type SupportCreateInput = { title: string; message: string; category?: string }
