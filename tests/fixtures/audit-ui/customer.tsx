'use client'
import { useEffect } from 'react'
import CustomerPortalSelfService from '@/components/customer/CustomerPortalSelfService'
import KundserviceClient from '@/app/(public)/kundservice/KundserviceClient'
import ForgotPasswordPage from '@/app/login/forgot-password/page'
export default function AuditCustomer(){useEffect(()=>{document.documentElement.dataset.auditReady='true'},[]);return <><CustomerPortalSelfService userId='11111111-1111-4111-8111-111111111111' site={{id:'facility_abcdefghijklmnopqrstuvwx',facilityId:'735999111222333444',meteringPointId:null,gridAreaCode:'AUDIT',priceAreaCode:'SE3'}} latestUnreadNotificationId='notification_abcdefghijklmnopqrstuvwx'/><ForgotPasswordPage/><KundserviceClient faqItems={[]}/></>}
