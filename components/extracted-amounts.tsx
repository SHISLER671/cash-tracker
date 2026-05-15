"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

type Category = "gas" | "food" | "medical" | "other"

interface ExtractedAmountsProps {
  amount: number
  onConfirm: (category: Category) => void
  onRetry: () => void
}

const categories: { id: Category; label: string; icon: string }[] = [
  { id: "gas", label: "GAS", icon: "⛽" },
  { id: "food", label: "FOOD", icon: "🍔" },
  { id: "medical", label: "MEDICAL", icon: "💊" },
  { id: "other", label: "OTHER", icon: "📦" },
]

export function ExtractedAmounts({ amount, onConfirm, onRetry }: ExtractedAmountsProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

  const handleSave = () => {
    if (selectedCategory) {
      onConfirm(selectedCategory)
    }
  }

  return (
    <div className="flex-1 bg-zinc-900 p-6 flex flex-col">
      {/* Extracted Amount Display */}
      <div className="text-center mb-8">
        <p className="text-zinc-400 text-sm uppercase tracking-wide mb-2">
          Extracted Amount
        </p>
        <div className="text-5xl font-bold text-white font-mono">
          ${amount.toFixed(2)}
        </div>
      </div>

      {/* Category Selection */}
      <div className="mb-8">
        <p className="text-zinc-400 text-sm uppercase tracking-wide mb-4 text-center">
          Select Category
        </p>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-5 rounded-2xl transition-all duration-200 active:scale-95",
                selectedCategory === category.id
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
                  selectedCategory === category.id ? "text-emerald-400" : "text-zinc-300"
                )}
              >
                {category.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto space-y-3">
        <button
          onClick={handleSave}
          disabled={!selectedCategory}
          className={cn(
            "w-full py-4 px-6 rounded-xl font-bold text-lg transition-all active:scale-[0.98]",
            selectedCategory
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          )}
        >
          SAVE
        </button>
        <button
          onClick={onRetry}
          className="w-full py-4 px-6 bg-zinc-800 text-white rounded-xl font-medium active:bg-zinc-700 transition-colors"
        >
          Retake Photo
        </button>
      </div>
    </div>
  )
}
