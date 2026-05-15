"use client"

import { useState } from "react"
import { Plus, Camera, Pencil } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function AddButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3">
      {/* Sub-buttons */}
      <div
        className={cn(
          "flex flex-col items-end gap-3 transition-all duration-200",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <Link
          href="/capture"
          className="flex items-center gap-3 group"
          onClick={() => setIsOpen(false)}
        >
          <span className="bg-zinc-800 text-white text-sm font-medium px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            Scan Receipt
          </span>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-white shadow-lg transition-all hover:bg-zinc-600 active:scale-95">
            <Camera className="h-5 w-5" />
          </div>
        </Link>
        <Link
          href="/transaction"
          className="flex items-center gap-3 group"
          onClick={() => setIsOpen(false)}
        >
          <span className="bg-zinc-800 text-white text-sm font-medium px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            Manual Entry
          </span>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-white shadow-lg transition-all hover:bg-zinc-600 active:scale-95">
            <Pencil className="h-5 w-5" />
          </div>
        </Link>
      </div>

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-all hover:bg-emerald-600 hover:shadow-xl active:scale-95",
          isOpen && "rotate-45"
        )}
        aria-label={isOpen ? "Close menu" : "Add transaction"}
      >
        <Plus className="h-8 w-8 transition-transform duration-200" strokeWidth={2.5} />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
