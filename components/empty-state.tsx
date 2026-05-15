"use client"

import { ArrowDown } from "lucide-react"

export function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-12">
      {/* Bouncing money animation */}
      <div className="relative">
        <span 
          className="text-6xl animate-bounce inline-block"
          style={{ animationDuration: "1s" }}
        >
          $
        </span>
      </div>
      
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground mb-2">
          Welcome to Cash Tracker!
        </h2>
        <p className="text-muted-foreground">
          Tap + below to add your first transaction
        </p>
      </div>
      
      {/* Arrow pointing down */}
      <div className="animate-bounce mt-4">
        <ArrowDown className="h-8 w-8 text-primary" />
      </div>
    </div>
  )
}
