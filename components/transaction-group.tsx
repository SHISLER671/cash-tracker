"use client"

import { Transaction } from "@/lib/types"
import { TransactionItem } from "./transaction-item"

interface TransactionGroupProps {
  label: string
  transactions: Transaction[]
  onEdit?: (transaction: Transaction) => void
  possibleDuplicates?: any[]
  onFlagClick?: (dup: any) => void
}

export function TransactionGroup({ label, transactions, onEdit, possibleDuplicates, onFlagClick }: TransactionGroupProps) {
  if (transactions.length === 0) return null
  
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
        {label}
      </h3>
      <div className="space-y-3">
        {transactions.map((transaction) => {
          const dup = possibleDuplicates?.find(d => d.local?.id === transaction.id)
          return (
            <TransactionItem 
              key={transaction.id} 
              transaction={transaction} 
              onEdit={onEdit}
              isDuplicate={!!dup}
              onFlagClick={dup && onFlagClick ? () => onFlagClick(dup) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
