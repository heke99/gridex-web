import Image from 'next/image'

type GridexLogoProps = {
  className?: string
  markOnly?: boolean
  inverted?: boolean
}

export default function GridexLogo({
  className = 'h-10 w-auto',
  markOnly = false,
  inverted = true,
}: GridexLogoProps) {
  const src = markOnly
    ? '/brand/gridex-mark.svg'
    : inverted
      ? '/brand/gridex-logo-inverted.svg'
      : '/brand/gridex-logo.svg'

  return (
    <Image
      src={src}
      alt="Gridex"
      className={className}
      width={markOnly ? 512 : 1200}
      height={markOnly ? 512 : 360}
      priority
      unoptimized
    />
  )
}
