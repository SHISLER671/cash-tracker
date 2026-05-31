"use client"

import { ArrowDown } from "lucide-react"

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-16">
      {/* Luxe coin badge */}
      <div
        className="flex h-24 w-24 items-center justify-center rounded-full border border-gold-light/40 bg-gradient-to-br from-gold-light to-gold-dark text-primary-foreground shadow-luxe animate-bounce"
        style={{ animationDuration: "1.4s" }}
      >
        <span className="text-5xl font-bold">$</span>
      </div>

      <div className="text-center">
        <h2 className="mb-2 text-2xl font-bold text-foreground">
          Welcome to Cash Tracker!
        </h2>
        <p className="text-muted-foreground">
          Tap + below to add your first transaction
        </p>
      </div>

      {/* Arrow pointing down */}
      <div className="mt-2 animate-bounce">
        <ArrowDown className="h-8 w-8 text-gold-dark" />
      </div>
    </div>
  )
}
