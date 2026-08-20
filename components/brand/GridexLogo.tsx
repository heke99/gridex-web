import Image from 'next/image'

type GridexLogoProps = {
  className?: string
  markOnly?: boolean
  inverted?: boolean
  priority?: boolean
}

export default function GridexLogo({
  className = 'h-10 w-auto',
  markOnly = false,
  inverted: _inverted = false,
  priority = false,
}: GridexLogoProps) {
  return (
    <Image
      src={markOnly ? '/icon.svg' : '/brand/gridex-logo-header.webp'}
      alt={markOnly ? 'Gridex' : 'Gridex – Energi för morgondagen'}
      className={className}
      width={markOnly ? 192 : 1000}
      height={markOnly ? 192 : 220}
      priority={priority}
      unoptimized
    />
  )
}
