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
  priority = false,
}: GridexLogoProps) {
  const src = markOnly ? '/icon.png' : '/brand/gridex-wordmark.webp'

  return (
    <Image
      src={src}
      alt="Gridex"
      className={className}
      width={markOnly ? 192 : 600}
      height={markOnly ? 192 : 111}
      priority={priority}
      unoptimized
    />
  )
}
