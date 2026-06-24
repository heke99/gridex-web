import Link from 'next/link'

export type BreadcrumbItem = {
  label: string
  href: string
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Brödsmulor" className="text-sm text-gray-500">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {index === items.length - 1 ? (
              <span className="text-gray-300">{item.label}</span>
            ) : (
              <Link href={item.href} className="hover:text-cyan-300">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
