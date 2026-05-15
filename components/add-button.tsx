import { Plus } from "lucide-react"
import Link from "next/link"

interface AddButtonProps {
  href?: string
  onClick?: () => void
}

export function AddButton({ href, onClick }: AddButtonProps) {
  const className =
    "fixed bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-all hover:bg-emerald-600 hover:shadow-xl active:scale-95"

  if (href) {
    return (
      <Link href={href} className={className} aria-label="Add transaction">
        <Plus className="h-8 w-8" strokeWidth={2.5} />
      </Link>
    )
  }

  return (
    <button onClick={onClick} className={className} aria-label="Add transaction">
      <Plus className="h-8 w-8" strokeWidth={2.5} />
    </button>
  )
}
