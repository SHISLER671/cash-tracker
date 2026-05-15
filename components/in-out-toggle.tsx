"use client"

import { cn } from "@/lib/utils"

interface InOutToggleProps {
  value: "in" | "out"
  onChange: (value: "in" | "out") => void
}

export function InOutToggle({ value, onChange }: InOutToggleProps) {
  return (
    <div className="flex items-center justify-center gap-2 p-1 bg-zinc-800 rounded-full">
      <button
        type="button"
        onClick={() => onChange("in")}
        className={cn(
          "px-8 py-3 rounded-full text-lg font-bold transition-all duration-200",
          value === "in"
            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
            : "text-zinc-400 hover:text-zinc-200"
        )}
      >
        IN
      </button>
      <button
        type="button"
        onClick={() => onChange("out")}
        className={cn(
          "px-8 py-3 rounded-full text-lg font-bold transition-all duration-200",
          value === "out"
            ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
            : "text-zinc-400 hover:text-zinc-200"
        )}
      >
        OUT
      </button>
    </div>
  )
}
