"use client"

import { cn } from "@/lib/utils"
import { Transaction, categoryIcons, categoryLabels } from "@/lib/types"

interface TransactionItemProps {
  transaction: Transaction
}

export function TransactionItem({ transaction }: TransactionItemProps) {
  const isIncome = transaction.type === "in"
  
  return (
    <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-xl active:bg-zinc-700/50 transition-colors">
      {/* Category Icon */}
      <div className={cn(
        "flex items-center justify-center w-12 h-12 rounded-full text-2xl",
        isIncome ? "bg-emerald-500/20" : "bg-zinc-700"
      )}>
        {categoryIcons[transaction.category]}
      </div>
      
      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-zinc-200 font-medium">
          {categoryLabels[transaction.category]}
        </p>
        {transaction.note && (
          <p className="text-zinc-500 text-sm truncate">{transaction.note}</p>
        )}
      </div>
      
      {/* Amount */}
      <div className={cn(
        "text-lg font-bold tabular-nums",
        isIncome ? "text-emerald-400" : "text-red-400"
      )}>
        {isIncome ? "+" : "-"}${transaction.amount.toFixed(2)}
      </div>
    </div>
  )
}
