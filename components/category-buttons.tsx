"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { Fuel, UtensilsCrossed, Pill, ShoppingCart, Package, Plus, Tag, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { db, getAllPresets, addPresetIfNew } from "@/lib/db"

interface CategoryButtonsProps {
  value: string | null
  onChange: (value: string) => void
}

// Default categories that always appear first, with matching icons
const DEFAULT_CATEGORIES = ["gas", "food", "medical", "groceries", "other"]

const ICONS: Record<string, LucideIcon> = {
  gas: Fuel,
  food: UtensilsCrossed,
  medical: Pill,
  groceries: ShoppingCart,
  other: Package,
}

function iconFor(name: string): LucideIcon {
  return ICONS[name.toLowerCase()] ?? Tag
}

export function CategoryButtons({ value, onChange }: CategoryButtonsProps) {
  // Live list of saved presets from Dexie, merged with the defaults
  const presets = useLiveQuery(() => getAllPresets(), [])

  const presetNames = (presets ?? []).map((p) => p.name.toLowerCase())
  const categories = [
    ...DEFAULT_CATEGORIES,
    ...presetNames.filter((name) => !DEFAULT_CATEGORIES.includes(name)),
  ]

  const handleAddCategory = async () => {
    const name = window.prompt("New category name?")?.trim()
    if (!name) return
    await addPresetIfNew(name)
    onChange(name.toLowerCase())
  }

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-md mx-auto sm:grid-cols-4">
      {categories.map((category) => {
        const Icon = iconFor(category)
        const isSelected = value?.toLowerCase() === category
        return (
          <button
            key={category}
            type="button"
            onClick={() => onChange(category)}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-all duration-200 active:scale-95",
              isSelected
                ? "bg-primary text-primary-foreground shadow-earth ring-2 ring-primary"
                : "bg-card text-foreground hover:bg-secondary",
            )}
          >
            <Icon className="h-7 w-7" />
            <span className="text-xs font-bold uppercase tracking-wide">{category}</span>
          </button>
        )
      })}

      <button
        type="button"
        onClick={handleAddCategory}
        className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-muted-foreground/40 text-muted-foreground transition-all duration-200 hover:bg-secondary active:scale-95"
      >
        <Plus className="h-7 w-7" />
        <span className="text-xs font-bold uppercase tracking-wide">New</span>
      </button>
    </div>
  )
}
