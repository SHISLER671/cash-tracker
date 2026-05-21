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
      {/* Prominent red flag for duplicates */}
      {isDuplicate && onFlagClick && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onFlagClick()
          }}
          className="absolute left-4 top-4 text-red-500 hover:text-red-600 transition-colors"
        >
          <Flag className="h-6 w-6 fill-red-500" />
        </button>
      )}

      {/* Category Icon */}
      <div className={cn(
        "flex items-center justify-center w-12 h-12 rounded-full text-sm font-bold flex-shrink-0",
        isIncome ? "bg-income/20 text-income" : "bg-secondary text-muted-foreground"
      )}>
        {categoryIcons[transaction.category] || "📦"}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 pl-8"> {/* extra padding for flag */}
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
