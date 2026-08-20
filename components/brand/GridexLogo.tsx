import Image from 'next/image'

type GridexLogoProps = {
  className?: string
  markOnly?: boolean
  inverted?: boolean
  priority?: boolean
}

export default function GridexLogo({
  className = 'h-10 w-auto',
  priority = false,
}: GridexLogoProps) {
  return (
    <Image
      src="/icon.svg"
      alt="Gridex"
      className={className}
      width={192}
      height={192}
      priority={priority}
      unoptimized
    />
  )
}
