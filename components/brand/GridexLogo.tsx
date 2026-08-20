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
      src={markOnly ? '/icon.svg' : '/brand/gridex-logo-upload.svg'}
      alt="Gridex"
      className={className}
      width={markOnly ? 192 : 600}
      height={markOnly ? 192 : 132}
      priority={priority}
      unoptimized
    />
  )
}
