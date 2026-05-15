"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { Transaction as DbTransaction } from "@/lib/db"
import { Transaction } from "@/lib/types"
import { TransactionList } from "@/components/transaction-list"

export default function HistoryPage() {
  const router = useRouter()

  // Get all transactions from Dexie, sorted by date descending
  const dbTransactions = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [])

  // Map Dexie transactions to UI format
  const transactions: Transaction[] = (dbTransactions ?? []).map((t: DbTransaction) => ({
    id: String(t.id),
    type: t.type,
    amount: t.amount,
    category: t.category,
    date: new Date(t.date),
    note: t.note,
  }))

  // Calculate totals
  const income = transactions
    .filter((t) => t.type === "in")
    .reduce((sum, t) => sum + t.amount, 0)

  const expenses = transactions
    .filter((t) => t.type === "out")
    .reduce((sum, t) => sum + t.amount, 0)

  const handleRefresh = useCallback(async () => {
    // With Dexie live queries, data refreshes automatically
    // This is just for the pull-to-refresh UX
    await new Promise((resolve) => setTimeout(resolve, 500))
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-zinc-800">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
          aria-label="Go back"
        >
          <svg
            className="w-5 h-5 text-zinc-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <h1 className="text-xl font-bold text-zinc-100">History</h1>

        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Summary */}
      <div className="flex items-center justify-center gap-8 p-4 border-b border-zinc-800">
        <div className="text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Income
          </p>
          <p className="text-lg font-bold text-emerald-400">
            +${income.toFixed(2)}
          </p>
        </div>
        <div className="w-px h-8 bg-zinc-800" />
        <div className="text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Expenses
          </p>
          <p className="text-lg font-bold text-red-400">
            -${expenses.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Transaction List */}
      <TransactionList transactions={transactions} onRefresh={handleRefresh} />
    </div>
  )
}
