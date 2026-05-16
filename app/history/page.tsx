"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeft } from "lucide-react"
import { db } from "@/lib/db"
import { Transaction as DbTransaction } from "@/lib/db"
import { TransactionList } from "@/components/transaction-list"
import EditTransactionModal from "@/components/EditTransactionModal"

export default function HistoryPage() {
  const router = useRouter()
  const [editingTransaction, setEditingTransaction] = useState<DbTransaction | null>(null)

  const dbTransactions = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [])

  const transactions = (dbTransactions ?? []).map((t: DbTransaction) => ({
    id: String(t.id),
    type: t.type,
    amount: t.amount,
    category: t.category,
    date: new Date(t.date),
    note: t.note,
  }))

  const income = transactions
    .filter((t) => t.type === "in")
    .reduce((sum, t) => sum + t.amount, 0)

  const expenses = transactions
    .filter((t) => t.type === "out")
    .reduce((sum, t) => sum + t.amount, 0)

  const handleEdit = (tx: { id: string }) => {
    const fullTx = dbTransactions?.find((t) => String(t.id) === tx.id)
    if (fullTx) setEditingTransaction(fullTx)
  }

  const handleModalSave = () => {
    setEditingTransaction(null)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-earth transition-all hover:bg-secondary active:scale-95 active:bg-primary/20"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <h1 className="text-lg font-bold text-foreground">History</h1>

        <div className="w-11" />
      </header>

      {/* Summary */}
      <div className="flex items-center justify-center gap-8 p-4 border-b border-border">
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Income
          </p>
          <p className="text-lg font-bold text-income">
            +${income.toFixed(2)}
          </p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Expenses
          </p>
          <p className="text-lg font-bold text-expense">
            -${expenses.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Transaction List */}
      <TransactionList
        transactions={transactions}
        onRefresh={async () => {}}
        onEdit={handleEdit}
      />

      <EditTransactionModal
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={handleModalSave}
      />
    </div>
  )
}
