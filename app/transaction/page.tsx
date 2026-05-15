"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { db } from "@/lib/db"
import { InOutToggle } from "@/components/in-out-toggle"
import { AmountInput } from "@/components/amount-input"
import { CategoryButtons, type Category } from "@/components/category-buttons"

export default function TransactionPage() {
  const router = useRouter()
  const [type, setType] = useState<"in" | "out">("out")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<Category | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isValid = amount && parseFloat(amount) > 0 && category

  const handleSave = async () => {
    if (!isValid || !category) return

    setIsSaving(true)

    try {
      await db.transactions.add({
        date: new Date(),
        category,
        type,
        amount: parseFloat(amount),
      })
      router.push("/")
    } catch (error) {
      console.error("Failed to save transaction:", error)
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800">
        <Link
          href="/"
          className="text-white p-2 -ml-2 active:bg-zinc-800 rounded-lg transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Link>
        <h1 className="text-white font-semibold text-lg">New Transaction</h1>
        <div className="w-10" />
      </header>

      {/* Form Content */}
      <div className="flex-1 flex flex-col px-4 py-6 gap-8">
        {/* IN/OUT Toggle */}
        <div className="flex justify-center">
          <InOutToggle value={type} onChange={setType} />
        </div>

        {/* Amount Input */}
        <div className="flex justify-center py-4">
          <AmountInput value={amount} onChange={setAmount} type={type} />
        </div>

        {/* Category Buttons */}
        <div className="flex-1 flex flex-col justify-center">
          <span className="text-zinc-500 text-sm font-medium uppercase tracking-wider text-center mb-4">
            Category
          </span>
          <CategoryButtons value={category} onChange={setCategory} />
        </div>
      </div>

      {/* Save Button */}
      <div className="p-4 pb-8">
        <button
          onClick={handleSave}
          disabled={!isValid || isSaving}
          className="w-full py-5 rounded-2xl text-xl font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400"
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Saving...
            </span>
          ) : (
            "SAVE"
          )}
        </button>
      </div>
    </div>
  )
}
