import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'BankID är inte aktiverat i det publika flödet ännu.' },
    { status: 404 }
  )
}
