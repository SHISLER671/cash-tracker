"use client"

import { cn } from "@/lib/utils"
import { Transaction, categoryIcons, categoryLabels } from "@/lib/types"
import { Flag } from "lucide-react"

interface TransactionItemProps {
  transaction: Transaction
  onEdit?: (transaction: Transaction) => void
  isDuplicate?: boolean
  onFlagClick?: () => void
}

export function TransactionItem({ transaction, onEdit, isDuplicate, onFlagClick }: TransactionItemProps) {
  const isIncome = transaction.type === "in"

  return (
    <div
      onClick={() => onEdit?.(transaction)}
      className={cn(
        "flex items-center gap-4 p-4 bg-card rounded-xl shadow-earth active:bg-secondary transition-colors cursor-pointer relative",
        isDuplicate && "ring-2 ring-amber-400"
      )}
    >
      {/* Flag icon for duplicates */}
      {isDuplicate && onFlagClick && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onFlagClick()
          }}
          className="absolute left-3 top-3 text-amber-500 hover:text-amber-600"
        >
          <Flag className="h-5 w-5" />
        </button>
      )}

      {/* Category Icon */}
      <div className={cn(
        "flex items-center justify-center w-12 h-12 rounded-full text-sm font-bold",
        isIncome ? "bg-income/20 text-income" : "bg-secondary text-muted-foreground"
      )}>
        {categoryIcons[transaction.category] || "📦"}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-medium">
          {categoryLabels[transaction.category] || transaction.category}
        </p>
        {transaction.merchant && (
          <p className="text-muted-foreground text-sm truncate">{transaction.merchant}</p>
        )}
        {transaction.note && (
          <p className="text-muted-foreground text-sm truncate">{transaction.note}</p>
        )}
      </div>

      {/* Amount */}
      <div className={cn(
        "text-lg font-bold tabular-nums",
        isIncome ? "text-income" : "text-expense"
      )}>
        {isIncome ? "+" : "-"}${transaction.amount.toFixed(2)}
      </div>
    </div>
  )
}
