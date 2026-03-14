import { supabaseService } from '@/lib/supabase/service'

export type CustomerAdminAgreement = {
  id: string
  user_id: string | null
  contract_slug: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  personal_number: string | null
  phone: string | null
  status: string | null
  sign_method: string | null
  created_at: string
  email_signed_at: string | null
  bankid_completed_at: string | null
  activated_at: string | null
  contract_pdf_path: string | null
  welcome_email_sent_at: string | null
}

export type CustomerAdminProfile = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  phone: string | null
  onboarding_state: string | null
  created_at: string | null
  last_login_at?: string | null
  total_logins?: number | null
}

export type CustomerAdminAcceptance = {
  id: string
  agreement_id: string
  type?: string | null
  acceptance_type?: string | null
  kind?: string | null
  category?: string | null
  version?: string | null
  document_hash?: string | null
  accepted_at: string
  ip_address?: string | null
  user_agent?: string | null
}

export type CustomerDocument = {
  id: string
  user_id: string
  agreement_id: string | null
  document_type: string
  title: string | null
  file_name: string | null
  storage_path: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type CustomerActivityEvent = {
  id: string
  user_id: string
  agreement_id: string | null
  event_type: string
  event_at: string
  summary: string | null
  payload: Record<string, unknown> | null
}

export type CustomerAdminCard = {
  userId: string
  email: string | null
  fullName: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  personalNumber: string | null
  onboardingState: string | null
  createdAt: string | null
  lastLoginAt: string | null
  totalLogins: number
  agreementsCount: number
  documentsCount: number
  activeAgreementsCount: number
  signedAgreementsCount: number
  latestAgreementCreatedAt: string | null
  latestAgreementId: string | null
  latestAgreementStatus: string | null
  latestContractSlug: string | null
  latestSignedAt: string | null
  latestActivatedAt: string | null
  latestAcceptedTermsAt: string | null
  latestAcceptedPrivacyAt: string | null
  latestAcceptedCookiesAt: string | null
}

export type CustomerAdminOverview = {
  cards: CustomerAdminCard[]
  totalCustomers: number
  activeCustomers: number
  signedCustomers: number
  customersWithDocuments: number
}

export type CustomerAdminDetail = {
  card: CustomerAdminCard | null
  profile: CustomerAdminProfile | null
  agreements: CustomerAdminAgreement[]
  acceptancesByAgreementId: Record<string, CustomerAdminAcceptance[]>
  documents: CustomerDocument[]
  activity: CustomerActivityEvent[]
}

function toFullName(parts: Array<string | null | undefined>, fallback = 'Okänd kund') {
  const joined = parts.filter(Boolean).join(' ').trim()
  return joined || fallback
}

function acceptanceTypeOf(
  acceptance: Pick<CustomerAdminAcceptance, 'type' | 'acceptance_type' | 'kind' | 'category'>
) {
  return (
    acceptance.type ??
    acceptance.acceptance_type ??
    acceptance.kind ??
    acceptance.category ??
    'acceptance'
  )
}

function signedAtOf(agreement: CustomerAdminAgreement) {
  return agreement.bankid_completed_at ?? agreement.email_signed_at ?? null
}

function cmpDesc(a: string | null | undefined, b: string | null | undefined) {
  const av = a ?? ''
  const bv = b ?? ''
  if (av === bv) return 0
  return av > bv ? -1 : 1
}

async function fetchProfiles() {
  const { data, error } = await supabaseService
    .from('customer_profiles')
    .select(
      'user_id,email,first_name,last_name,full_name,phone,onboarding_state,created_at,last_login_at,total_logins'
    )
    .returns<CustomerAdminProfile[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

async function fetchAgreements() {
  const { data, error } = await supabaseService
    .from('contract_agreements')
    .select(
      'id,user_id,contract_slug,first_name,last_name,email,personal_number,phone,status,sign_method,created_at,email_signed_at,bankid_completed_at,activated_at,contract_pdf_path,welcome_email_sent_at'
    )
    .order('created_at', { ascending: false })
    .returns<CustomerAdminAgreement[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

async function fetchAcceptances() {
  const { data, error } = await supabaseService
    .from('legal_acceptances')
    .select('*')
    .order('accepted_at', { ascending: false })
    .returns<CustomerAdminAcceptance[]>()

  if (error) throw new Error(error.message)
  return data ?? []
}

async function fetchDocuments() {
  const { data, error } = await supabaseService
    .from('customer_documents')
    .select('id,user_id,agreement_id,document_type,title,file_name,storage_path,metadata,created_at')
    .order('created_at', { ascending: false })
    .returns<CustomerDocument[]>()

  if (error) {
    if (error.message.toLowerCase().includes('customer_documents')) {
      return []
    }
    throw new Error(error.message)
  }

  return data ?? []
}

async function fetchActivity() {
  const { data, error } = await supabaseService
    .from('customer_activity_events')
    .select('id,user_id,agreement_id,event_type,event_at,summary,payload')
    .order('event_at', { ascending: false })
    .limit(500)
    .returns<CustomerActivityEvent[]>()

  if (error) {
    if (error.message.toLowerCase().includes('customer_activity_events')) {
      return []
    }
    throw new Error(error.message)
  }

  return data ?? []
}

function buildOverview(params: {
  profiles: CustomerAdminProfile[]
  agreements: CustomerAdminAgreement[]
  acceptances: CustomerAdminAcceptance[]
  documents: CustomerDocument[]
  query?: string
}): CustomerAdminOverview {
  const { profiles, agreements, acceptances, documents, query } = params

  const profileByUserId = new Map<string, CustomerAdminProfile>()
  for (const profile of profiles) profileByUserId.set(profile.user_id, profile)

  const agreementsByUserId = new Map<string, CustomerAdminAgreement[]>()
  for (const agreement of agreements) {
    if (!agreement.user_id) continue
    const current = agreementsByUserId.get(agreement.user_id) ?? []
    current.push(agreement)
    agreementsByUserId.set(agreement.user_id, current)
  }

  const acceptancesByAgreementId = new Map<string, CustomerAdminAcceptance[]>()
  for (const acceptance of acceptances) {
    const current = acceptancesByAgreementId.get(acceptance.agreement_id) ?? []
    current.push(acceptance)
    acceptancesByAgreementId.set(acceptance.agreement_id, current)
  }

  const documentsByUserId = new Map<string, CustomerDocument[]>()
  for (const document of documents) {
    const current = documentsByUserId.get(document.user_id) ?? []
    current.push(document)
    documentsByUserId.set(document.user_id, current)
  }

  const userIds = new Set<string>()
  for (const profile of profiles) userIds.add(profile.user_id)
  for (const agreement of agreements) if (agreement.user_id) userIds.add(agreement.user_id)

  const cards: CustomerAdminCard[] = []

  for (const userId of userIds) {
    const profile = profileByUserId.get(userId) ?? null
    const userAgreements = (agreementsByUserId.get(userId) ?? []).sort((a, b) =>
      cmpDesc(a.created_at, b.created_at)
    )
    const latestAgreement = userAgreements[0] ?? null
    const userDocuments = documentsByUserId.get(userId) ?? []

    const latestAcceptanceByType = new Map<string, string>()
    for (const agreement of userAgreements) {
      const items = acceptancesByAgreementId.get(agreement.id) ?? []
      for (const item of items) {
        const acceptanceType = acceptanceTypeOf(item)
        const current = latestAcceptanceByType.get(acceptanceType)
        if (!current || item.accepted_at > current) {
          latestAcceptanceByType.set(acceptanceType, item.accepted_at)
        }
      }
    }

    const fullName = toFullName(
      [
        profile?.full_name,
        profile?.first_name,
        profile?.last_name,
        latestAgreement?.first_name,
        latestAgreement?.last_name,
      ],
      'Okänd kund'
    )

    const personalNumber = userAgreements.find((item) => item.personal_number)?.personal_number ?? null
    const signedAgreementsCount = userAgreements.filter((item) => signedAtOf(item)).length
    const activeAgreementsCount = userAgreements.filter(
      (item) => item.activated_at || item.status === 'finalized'
    ).length

    cards.push({
      userId,
      email: profile?.email ?? latestAgreement?.email ?? null,
      fullName,
      firstName: profile?.first_name ?? latestAgreement?.first_name ?? null,
      lastName: profile?.last_name ?? latestAgreement?.last_name ?? null,
      phone: profile?.phone ?? userAgreements.find((item) => item.phone)?.phone ?? null,
      personalNumber,
      onboardingState: profile?.onboarding_state ?? null,
      createdAt: profile?.created_at ?? latestAgreement?.created_at ?? null,
      lastLoginAt: profile?.last_login_at ?? null,
      totalLogins: profile?.total_logins ?? 0,
      agreementsCount: userAgreements.length,
      documentsCount: userDocuments.length,
      activeAgreementsCount,
      signedAgreementsCount,
      latestAgreementCreatedAt: latestAgreement?.created_at ?? null,
      latestAgreementId: latestAgreement?.id ?? null,
      latestAgreementStatus: latestAgreement?.status ?? null,
      latestContractSlug: latestAgreement?.contract_slug ?? null,
      latestSignedAt: latestAgreement ? signedAtOf(latestAgreement) : null,
      latestActivatedAt: latestAgreement?.activated_at ?? null,
      latestAcceptedTermsAt:
        latestAcceptanceByType.get('terms') ??
        latestAcceptanceByType.get('agreement_terms') ??
        null,
      latestAcceptedPrivacyAt:
        latestAcceptanceByType.get('privacy') ??
        latestAcceptanceByType.get('privacy_policy') ??
        null,
      latestAcceptedCookiesAt:
        latestAcceptanceByType.get('cookies') ??
        latestAcceptanceByType.get('cookie_policy') ??
        null,
    })
  }

  const normalizedQuery = query?.trim().toLowerCase() ?? ''
  const filteredCards = normalizedQuery
    ? cards.filter((card) => {
        return [
          card.fullName,
          card.email,
          card.personalNumber,
          card.phone,
          card.latestContractSlug,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      })
    : cards

  filteredCards.sort((a, b) =>
    cmpDesc(a.latestAgreementCreatedAt ?? a.createdAt, b.latestAgreementCreatedAt ?? b.createdAt)
  )

  return {
    cards: filteredCards,
    totalCustomers: cards.length,
    activeCustomers: cards.filter((item) => item.activeAgreementsCount > 0).length,
    signedCustomers: cards.filter((item) => item.signedAgreementsCount > 0).length,
    customersWithDocuments: cards.filter((item) => item.documentsCount > 0).length,
  }
}

export async function getCustomerAdminOverview(query?: string): Promise<CustomerAdminOverview> {
  const [profiles, agreements, acceptances, documents] = await Promise.all([
    fetchProfiles(),
    fetchAgreements(),
    fetchAcceptances(),
    fetchDocuments(),
  ])

  return buildOverview({ profiles, agreements, acceptances, documents, query })
}

export async function getCustomerAdminDetail(userId: string): Promise<CustomerAdminDetail> {
  const [profiles, agreements, acceptances, documents, activity] = await Promise.all([
    fetchProfiles(),
    fetchAgreements(),
    fetchAcceptances(),
    fetchDocuments(),
    fetchActivity(),
  ])

  const overview = buildOverview({ profiles, agreements, acceptances, documents })
  const card = overview.cards.find((item) => item.userId === userId) ?? null
  const profile = profiles.find((item) => item.user_id === userId) ?? null
  const customerAgreements = agreements
    .filter((item) => item.user_id === userId)
    .sort((a, b) => cmpDesc(a.created_at, b.created_at))

  const agreementIds = new Set(customerAgreements.map((item) => item.id))
  const acceptancesByAgreementId: Record<string, CustomerAdminAcceptance[]> = {}
  for (const acceptance of acceptances) {
    if (!agreementIds.has(acceptance.agreement_id)) continue
    if (!acceptancesByAgreementId[acceptance.agreement_id]) {
      acceptancesByAgreementId[acceptance.agreement_id] = []
    }
    acceptancesByAgreementId[acceptance.agreement_id].push(acceptance)
  }

  return {
    card,
    profile,
    agreements: customerAgreements,
    acceptancesByAgreementId,
    documents: documents.filter((item) => item.user_id === userId),
    activity: activity.filter((item) => item.user_id === userId),
  }
}