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
  inverted = false,
  priority = false,
}: GridexLogoProps) {
  const src = markOnly
    ? '/icon.png'
    : inverted
      ? '/brand/gridex-logo-inverted.svg'
      : '/brand/gridex-logo.svg'

  return (
    <Image
      src={src}
      alt="Gridex"
      className={className}
      width={markOnly ? 192 : 1200}
      height={markOnly ? 192 : 360}
      priority={priority}
      unoptimized
    />
  )
}
