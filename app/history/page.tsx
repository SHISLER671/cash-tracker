"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeft, Flag } from "lucide-react"
import { db, type Transaction } from "@/lib/db"
import EditTransactionModal from "@/components/EditTransactionModal"
import { TransactionList } from "@/components/transaction-list"
import { autoPullIfNeeded } from "@/lib/supabase/sync"

function HistoryPageSkeleton() {
  return <div className="min-h-screen bg-background flex items-center justify-center">Loading history...</div>
}

function HistoryPageContent() {
  const router = useRouter()
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [possibleDuplicates, setPossibleDuplicates] = useState<any[]>([])
  const [showReviewModal, setShowReviewModal] = useState(false)

  // Load duplicates on every History visit
  useEffect(() => {
    autoPullIfNeeded()

    const stored = localStorage.getItem("possibleDuplicates")
    if (stored) {
      setPossibleDuplicates(JSON.parse(stored))
    }
  }, [])

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

  const handleReviewDuplicates = () => {
    setShowReviewModal(true)
  }

  const handleDeleteDuplicate = async (dup: any) => {
    if (dup.local?.id) await db.transactions.delete(dup.local.id)
    const remaining = possibleDuplicates.filter(d => d !== dup)
    setPossibleDuplicates(remaining)
    localStorage.setItem("possibleDuplicates", JSON.stringify(remaining))
  }

  const handleMergeDuplicate = async (dup: any) => {
    const keep = dup.remote.merchant ? dup.remote : dup.local
    const remove = dup.remote.merchant ? dup.local : dup.remote
    if (remove?.id) await db.transactions.delete(remove.id)

    const remaining = possibleDuplicates.filter(d => d !== dup)
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

      {/* Clean Duplicate Banner */}
      {possibleDuplicates.length > 0 && (
        <div className="mx-4 mt-4 bg-amber-100 border border-amber-300 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-amber-800">Possible duplicates detected ({possibleDuplicates.length})</p>
            <p className="text-sm text-amber-700">Some entries may be the same receipt added twice</p>
          </div>
          <button
            onClick={handleReviewDuplicates}
            className="px-5 py-2 bg-amber-600 text-white rounded-xl font-medium active:scale-95 transition-all"
          >
            Review
          </button>
        </div>
      )}

      <div className="p-4">
        <TransactionList transactions={transactions} onEdit={setEditingTransaction} />
      </div>

      {/* Duplicate Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-earth-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Review Possible Duplicates</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose what to keep</p>
            </div>

            <div className="p-6 space-y-6">
              {possibleDuplicates.map((dup, i) => (
                <div key={i} className="border border-amber-200 rounded-2xl p-4">
                  <div className="flex justify-between text-sm mb-3">
                    <div className="font-medium">
                      ${dup.local?.amount || dup.remote?.amount} • {dup.local?.merchant || dup.remote?.merchant}
                    </div>
                    <div className="text-amber-600 text-xs">{dup.reason}</div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDeleteDuplicate(dup)}
                      className="flex-1 py-3 text-red-600 bg-red-50 rounded-xl text-sm font-medium"
                    >
                      Delete One
                    </button>
                    <button
                      onClick={() => handleMergeDuplicate(dup)}
                      className="flex-1 py-3 bg-amber-600 text-white rounded-xl text-sm font-medium"
                    >
                      Merge (keep best)
                    </button>
                    <button
                      onClick={() => {
                        const remaining = possibleDuplicates.filter((_, idx) => idx !== i)
                        setPossibleDuplicates(remaining)
                        localStorage.setItem("possibleDuplicates", JSON.stringify(remaining))
                      }}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium"
                    >
                      Keep Both
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="flex-1 py-4 text-muted-foreground font-medium"
              >
                Back
              </button>
              <button
                onClick={() => {
                  setShowReviewModal(false)
                  // Force refresh
                  window.location.reload()
                }}
                className="flex-1 py-4 bg-black text-white font-semibold rounded-2xl"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSave={() => {}}
        />
      )}
    </div>
  )
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryPageSkeleton />}>
      <HistoryPageContent />
    </Suspense>
  )
}
