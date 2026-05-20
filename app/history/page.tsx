"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeft } from "lucide-react"
import { db, type Transaction } from "@/lib/db"
import EditTransactionModal from "@/components/EditTransactionModal"
import { TransactionList } from "@/components/transaction-list"

export default function HistoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [possibleDuplicates, setPossibleDuplicates] = useState<any[]>([])

  // Load possible duplicates from localStorage when ?review=duplicates is present
  useEffect(() => {
    const reviewMode = searchParams.get("review")
    if (reviewMode === "duplicates") {
      const stored = localStorage.getItem("possibleDuplicates")
      if (stored) {
        setPossibleDuplicates(JSON.parse(stored))
      }
    }
  }, [searchParams])

  const dbTransactions = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [])

  const transactions: Transaction[] = (dbTransactions ?? []).map((t: any) => ({
    id: t.id,
    date: new Date(t.date),
    amount: t.amount,
    merchant: t.merchant || "",
    category: t.category,
    type: t.type,
    note: t.note,
  }))

  const handleDeleteDuplicate = async (duplicate: any) => {
    if (duplicate.local?.id) {
      await db.transactions.delete(duplicate.local.id)
    }
    // Remove from review list
    const remaining = possibleDuplicates.filter(d => d !== duplicate)
    setPossibleDuplicates(remaining)
    localStorage.setItem("possibleDuplicates", JSON.stringify(remaining))
  }

  const handleMergeDuplicate = async (duplicate: any) => {
    // Keep the one with more complete data (prefer the one with merchant)
    const keep = duplicate.remote.merchant ? duplicate.remote : duplicate.local
    const remove = duplicate.remote.merchant ? duplicate.local : duplicate.remote

    if (remove?.id) await db.transactions.delete(remove.id)

    const remaining = possibleDuplicates.filter(d => d !== duplicate)
    setPossibleDuplicates(remaining)
    localStorage.setItem("possibleDuplicates", JSON.stringify(remaining))
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b">
        <button onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-earth">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">History</h1>
        <div className="w-11" />
      </header>

      {/* Duplicate Review Banner */}
      {possibleDuplicates.length > 0 && (
        <div className="mx-4 mt-4 bg-amber-100 border border-amber-300 rounded-2xl p-4">
          <p className="font-semibold text-amber-800">Possible duplicates detected ({possibleDuplicates.length})</p>
          <p className="text-sm text-amber-700 mt-1">Review before they sync to other devices</p>
          
          {possibleDuplicates.map((dup, i) => (
            <div key={i} className="mt-4 bg-white rounded-xl p-4 border border-amber-200">
              <div className="flex justify-between text-sm">
                <div>
                  <span className="font-medium">${dup.local?.amount || dup.remote?.amount}</span>
                  <span className="text-muted-foreground ml-2">{dup.local?.merchant || dup.remote?.merchant}</span>
                </div>
                <div className="text-xs text-amber-600">Same day • similar amount</div>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleDeleteDuplicate(dup)}
                  className="flex-1 py-3 text-red-600 bg-red-50 rounded-xl font-medium text-sm"
                >
                  Delete One
                </button>
                <button
                  onClick={() => handleMergeDuplicate(dup)}
                  className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-medium text-sm"
                >
                  Merge
                </button>
                <button
                  onClick={() => {
                    const remaining = possibleDuplicates.filter((_, idx) => idx !== i)
                    setPossibleDuplicates(remaining)
                    localStorage.setItem("possibleDuplicates", JSON.stringify(remaining))
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm"
                >
                  Keep Both
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Normal transaction list */}
      <div className="p-4">
        <TransactionList
          transactions={transactions}
          onEdit={setEditingTransaction}
        />
      </div>

      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={() => {
            // Refresh happens automatically via live query
          }}
        />
      )}
    </div>
  )
}
