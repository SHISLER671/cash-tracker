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
        "card-luxe flex items-center gap-4 p-5 active:scale-[0.985] transition-all cursor-pointer relative",
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
          className="absolute left-4 top-4 text-destructive hover:brightness-90 transition-all"
        >
          <Flag className="h-6 w-6 fill-current" />
        </button>
      )}

      {/* Category Icon */}
      <div className={cn(
        "flex items-center justify-center w-14 h-14 rounded-2xl text-lg font-bold flex-shrink-0",
        isIncome ? "bg-income/15 text-income" : "bg-expense/15 text-expense"
      )}>
        {categoryIcons[transaction.category] || "📦"}
      </div>

      {/* Details */}
      <div className={cn("flex-1 min-w-0", isDuplicate && "pl-8")}>
        <p className="text-foreground font-semibold text-lg truncate">
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
        "text-2xl font-semibold tabular-nums",
        isIncome ? "text-income" : "text-expense"
      )}>
        {isIncome ? "+" : "-"}${transaction.amount.toFixed(2)}
      </div>
    </div>
  )
}
