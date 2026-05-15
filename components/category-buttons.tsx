"use client"

import { cn } from "@/lib/utils"

type Category = "gas" | "food" | "medical" | "other"

interface CategoryButtonsProps {
  value: Category | null
  onChange: (value: Category) => void
}

const categories: { id: Category; label: string; icon: string }[] = [
  { id: "gas", label: "GAS", icon: "⛽" },
  { id: "food", label: "FOOD", icon: "🍔" },
  { id: "medical", label: "MEDICAL", icon: "💊" },
  { id: "other", label: "OTHER", icon: "📦" },
]

export function CategoryButtons({ value, onChange }: CategoryButtonsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onChange(category.id)}
          className={cn(
            "flex flex-col items-center justify-center gap-2 p-5 rounded-2xl transition-all duration-200 active:scale-95",
            value === category.id
              ? "bg-zinc-700 ring-2 ring-emerald-500 shadow-lg"
              : "bg-zinc-800 hover:bg-zinc-700"
          )}
        >
          <span className="text-4xl" role="img" aria-label={category.label}>
            {category.icon}
          </span>
          <span
            className={cn(
              "text-sm font-bold tracking-wide",
              value === category.id ? "text-emerald-400" : "text-zinc-300"
            )}
          >
            {category.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export type { Category }
