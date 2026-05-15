"use client"

import { Transaction } from "@/lib/types"
import { TransactionItem } from "./transaction-item"

interface TransactionGroupProps {
  label: string
  transactions: Transaction[]
}

export function TransactionGroup({ label, transactions }: TransactionGroupProps) {
  if (transactions.length === 0) return null
  
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider px-1">
        {label}
      </h3>
      <div className="space-y-2">
        {transactions.map((transaction) => (
          <TransactionItem key={transaction.id} transaction={transaction} />
        ))}
      </div>
    </div>
  )
}
