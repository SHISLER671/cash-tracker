"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { QuickCashSheet } from "@/components/quick-cash-sheet"

export function AddButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Log cash"
        className="fixed bottom-8 right-6 z-50 flex h-20 w-20 items-center justify-center rounded-3xl border border-gold-light/40 bg-gradient-to-br from-gold-light to-gold-dark text-primary-foreground shadow-luxe transition-all hover:brightness-110 active:scale-95"
      >
        <Plus className="h-10 w-10" />
      </button>

      <QuickCashSheet open={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
