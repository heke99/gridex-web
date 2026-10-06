'use client'
import { useEffect } from 'react'
import ApplicationStatusCard from '@/components/signup/ApplicationStatusCard'
import SwitchStatusCard from '@/components/signup/SwitchStatusCard'
export default function StatusFixture(){
  useEffect(()=>{document.documentElement.dataset.auditReady='true'},[])
  return <><ApplicationStatusCard applicationNumber="APP-AUDIT" resultToken="synthetic-receipt" initialStatus="processing"/><SwitchStatusCard resultToken="synthetic-receipt" initialStatus="submitted"/></>
}
