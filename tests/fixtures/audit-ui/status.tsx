'use client'
import { useEffect } from 'react'
import ApplicationStatusCard from '@/components/signup/ApplicationStatusCard'
import SwitchStatusCard from '@/components/signup/SwitchStatusCard'
export default function StatusFixture(){
  useEffect(()=>{document.documentElement.dataset.auditReady='true'},[])
  return <>
    <ApplicationStatusCard applicationNumber="APP-AUDIT" resultToken="synthetic-receipt" receipt={{
      status: 'processing', pageState: 'processing', customerNumber: null, contractNumber: null, contractStatus: null,
      signedAt: null, withdrawalDeadlineAt: null, nextStep: null, powerOfAttorneySigned: true,
    }} />
    <SwitchStatusCard resultToken="synthetic-receipt" initialStatus="submitted" />
  </>
}
