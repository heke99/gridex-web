import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({
    status: 'initiated',
    message: 'BankID initiation placeholder'
  })
}