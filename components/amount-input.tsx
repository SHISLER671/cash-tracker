"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  type: "in" | "out"
}

export function AmountInput({ value, onChange, type }: AmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus input on mount for quick entry
    inputRef.current?.focus()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, "")
    // Only allow one decimal point
    const parts = rawValue.split(".")
    if (parts.length > 2) return
    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) return
    onChange(rawValue)
  }

  const displayValue = value || "0"

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-zinc-500 text-sm font-medium uppercase tracking-wider">
        Amount
      </span>
      <div className="relative flex items-center justify-center">
        <span
          className={cn(
            "text-6xl font-bold",
            type === "in" ? "text-emerald-400" : "text-red-400"
          )}
        >
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          className={cn(
            "bg-transparent text-6xl font-bold outline-none w-48 text-center",
            type === "in" ? "text-emerald-400" : "text-red-400"
          )}
          placeholder="0"
        />
      </div>
    </div>
  )
}
