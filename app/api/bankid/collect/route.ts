import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    status: 'pending',
    message: 'BankID collect placeholder'
  })
}