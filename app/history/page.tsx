"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeft } from "lucide-react"
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
  const [selectedGroup, setSelectedGroup] = useState<any>(null)

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

  const openDuplicateModal = (group: any) => {
    setSelectedGroup(group)
    setShowReviewModal(true)
  }

  const closeModal = () => {
    setShowReviewModal(false)
    setSelectedGroup(null)
  }

  const handleDeleteFromGroup = async (dup: any) => {
    if (dup.local?.id) await db.transactions.delete(dup.local.id)
    const remaining = possibleDuplicates.filter(d => d !== dup)
    setPossibleDuplicates(remaining)
    localStorage.setItem("possibleDuplicates", JSON.stringify(remaining))
  }

  const handleSaveAndClose = () => {
    closeModal()
    window.location.reload() // forces full refresh + sync
  }

  // Safe date formatting helper
  const formatDate = (date: any) => {
    try {
      const d = date instanceof Date ? date : new Date(date)
      return d.toLocaleDateString()
    } catch {
      return "Unknown date"
    }
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

      <div className="p-4">
        <TransactionList 
          transactions={transactions} 
          onEdit={setEditingTransaction}
          possibleDuplicates={possibleDuplicates}
          onFlagClick={openDuplicateModal}
        />
      </div>

      {/* Duplicate Review Modal */}
      {showReviewModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-earth-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold">Possible Duplicate</h2>
              <p className="text-sm text-muted-foreground mt-1">{selectedGroup.reason || "These entries look similar"}</p>
            </div>

            <div className="p-6 space-y-8">
              {/* Local entry */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">LOCAL ENTRY</p>
                <div className="bg-card p-4 rounded-2xl">
                  <p className="font-medium">${selectedGroup.local?.amount?.toFixed(2) || "?"} • {selectedGroup.local?.merchant || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{selectedGroup.local?.category || "other"} • {formatDate(selectedGroup.local?.date)}</p>
                </div>
                <button
                  onClick={() => handleDeleteFromGroup(selectedGroup)}
                  className="mt-3 w-full py-3 text-red-600 bg-red-50 rounded-2xl font-medium"
                >
                  Delete this version
                </button>
              </div>

              {/* Remote entry */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">FROM PARTNER</p>
                <div className="bg-card p-4 rounded-2xl">
                  <p className="font-medium">${selectedGroup.remote?.amount?.toFixed(2) || "?"} • {selectedGroup.remote?.merchant || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{selectedGroup.remote?.category || "other"} • {formatDate(selectedGroup.remote?.date)}</p>
                </div>
                <button
                  onClick={() => {
                    // Keep local, delete remote from our copy
                    const remaining = possibleDuplicates.filter(d => d !== selectedGroup)
                    setPossibleDuplicates(remaining)
                    localStorage.setItem("possibleDuplicates", JSON.stringify(remaining))
                    closeModal()
                  }}
                  className="mt-3 w-full py-3 bg-amber-600 text-white rounded-2xl font-medium"
                >
                  Delete this version (keep local)
                </button>
              </div>
            </div>

            <div className="p-4 border-t flex gap-3">
              <button onClick={closeModal} className="flex-1 py-4 text-muted-foreground font-medium">Back</button>
              <button onClick={handleSaveAndClose} className="flex-1 py-4 bg-black text-white font-semibold rounded-2xl">Save & Close</button>
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
