'use client'

import { useEffect } from 'react'
import CustomerPortalSelfService from '@/components/customer/CustomerPortalSelfService'
import KundserviceClient from '@/app/(public)/kundservice/KundserviceClient'
import CustomerDocumentPages from '@/components/customer/CustomerDocumentPages'
import PoaArchivePages from '@/components/customer/PoaArchivePages'
import type { CustomerDocument } from '@/lib/customerPortal/types'
import AttachmentUpload from '@/components/support/AttachmentUpload'
import ForgotPasswordPage from '@/app/login/forgot-password/page'

export default function AuditCustomer() {
  useEffect(() => {
    document.documentElement.dataset.auditReady = 'true'
  }, [])

  return <>
    <CustomerPortalSelfService
      userId="11111111-1111-4111-8111-111111111111"
      moveOutSites={[{
        reference: 'facility_abcdefghijklmnopqrstuvwx',
        address: 'Testgatan 1',
        facilityId: '735999111222333444',
      }]}
      site={{
        id: 'facility_abcdefghijklmnopqrstuvwx',
        facilityId: '735999111222333444',
        meteringPointId: null,
        gridAreaCode: 'AUDIT',
        priceAreaCode: 'SE3',
      }}
      latestUnreadNotificationId="notification_abcdefghijklmnopqrstuvwx"
    />
    <ForgotPasswordPage />
    <KundserviceClient faqItems={[]} />
    <div data-testid="customer-attachment"><AttachmentUpload endpoint="/api/audit/customer-attachment" /></div>
    <div data-testid="staff-attachment"><AttachmentUpload endpoint="/api/audit/staff-attachment" staff /></div>
    <CustomerDocumentPages initialPage={{
      data: [{ id: 'document-one', title: 'Ordinarie dokument sida ett' } as CustomerDocument],
      page: { hasMore: true, nextCursor: 'documents-next' },
    }} />
    <PoaArchivePages initialPage={{
      data: [{
        power_of_attorney_reference: 'poa-one',
        verification_reference: 'arkiv-sida-ett',
        consent_status: null,
        archive_status: 'missing',
        archived_sha256: null,
        download_url: null,
      }],
      page: { limit: 20, offset: 0, returned: 1, has_more: true, next_cursor: 'archive-next' },
    }} />
  </>
}
