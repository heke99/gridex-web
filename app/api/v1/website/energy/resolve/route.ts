import { NextResponse } from 'next/server'
import {
  getOpsClientStatus,
  isOpsError,
  resolveOpsWebsiteEnergyArea,
} from '@/lib/ops/client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ResolvePayload = {
  postal_code?: unknown
  postalCode?: unknown
  city?: unknown
  street?: unknown
  address?: unknown
  apartment?: unknown
}

function text(value: unknown, max = 180): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed ? trimmed : null
}

function normalizePostalCode(value: unknown): string | null {
  const normalized = text(value, 20)?.replace(/\s+/g, '') ?? null
  return normalized && /^\d{5}$/.test(normalized) ? normalized : null
}

export async function POST(req: Request) {
  const status = getOpsClientStatus()

  if (!status.configured) {
    return NextResponse.json(
      { error: 'Elområde kan inte kontrolleras just nu.' },
      { status: 503 }
    )
  }

  const body = (await req.json().catch(() => null)) as ResolvePayload | null
  const postalCode = normalizePostalCode(body?.postal_code ?? body?.postalCode)

  if (!postalCode) {
    return NextResponse.json(
      { error: 'Ange ett svenskt postnummer med 5 siffror.' },
      { status: 400 }
    )
  }

  try {
    const data = await resolveOpsWebsiteEnergyArea({
      postal_code: postalCode,
      city: text(body?.city),
      street: text(body?.street ?? body?.address),
      address: text(body?.address ?? body?.street),
      apartment: text(body?.apartment, 60),
    })

    return NextResponse.json({ data })
  } catch (error) {
    const message =
      isOpsError(error) && error.status === 404
        ? 'Elområde kunde inte kontrolleras automatiskt just nu.'
        : error instanceof Error
          ? error.message
          : 'Elområde kunde inte kontrolleras automatiskt just nu.'

    return NextResponse.json(
      { error: message },
      { status: isOpsError(error) ? error.status : 502 }
    )
  }
}
