"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeft, AlertTriangle, Trash2 } from "lucide-react"
import { db, softDeleteTransaction, type Transaction } from "@/lib/db"
import EditTransactionModal from "@/components/EditTransactionModal"
import { TransactionList } from "@/components/transaction-list"
import { syncNow } from "@/lib/supabase/sync"

const DISMISSED_KEY = "dismissedDuplicates"

// A duplicate "signature": two transactions that share the same calendar day,
// amount, category, type and merchant are almost certainly the same expense
// entered (or synced) twice. Merchant is included to keep this conservative so
// genuinely-distinct same-day, same-amount purchases aren't falsely flagged.
function dupKey(t: { date: Date; amount: number; category: string; type: string; merchant?: string }) {
  const day = new Date(t.date).toISOString().split("T")[0]
  const merchant = (t.merchant || "").trim().toLowerCase()
  return `${day}|${Number(t.amount).toFixed(2)}|${String(t.category).toLowerCase()}|${t.type}|${merchant}`
}

type DuplicateGroup = { key: string; reason: string; items: Transaction[] }

function findDuplicateGroups(transactions: Transaction[], dismissed: Set<string>): DuplicateGroup[] {
  const byKey = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const k = dupKey(t)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k)!.push(t)
  }

  const groups: DuplicateGroup[] = []
  for (const [key, items] of byKey) {
    if (items.length >= 2 && !dismissed.has(key)) {
      groups.push({
        key,
        items,
        reason: `${items.length} entries share the same date, amount, and category`,
      })
    }
  }
  return groups
}

function HistoryPageSkeleton() {
  return <div className="min-h-screen bg-background flex items-center justify-center">Loading history...</div>
}

function HistoryPageContent() {
  const router = useRouter()
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    syncNow()

    const stored = localStorage.getItem(DISMISSED_KEY)
    if (stored) {
      try {
        setDismissedKeys(JSON.parse(stored))
      } catch {
        // ignore corrupt value
      }
    }
  }, [])

  const dbTransactions = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [])

  // Stable mapped list (only recomputes when the underlying rows change).
  const transactions: Transaction[] = useMemo(
    () =>
      (dbTransactions ?? []).map((t: any) => ({
        id: t.id,
        date: new Date(t.date),
        amount: t.amount,
        merchant: t.merchant || "",
        category: t.category,
        type: t.type,
        note: t.note,
      })),
    [dbTransactions],
  )

  const dismissedSet = useMemo(() => new Set(dismissedKeys), [dismissedKeys])
  const duplicateGroups = useMemo(
    () => findDuplicateGroups(transactions, dismissedSet),
    [transactions, dismissedSet],
  )

  // One flag entry per duplicated transaction, in the shape the list plumbing
  // already understands ({ local: { id } }). The full group rides along so the
  // review modal can show every copy.
  const flagged = useMemo(() => {
    const arr: { local: { id?: number }; group: DuplicateGroup }[] = []
    for (const group of duplicateGroups) {
      for (const item of group.items) {
        arr.push({ local: { id: item.id }, group })
      }
    }
    return arr
  }, [duplicateGroups])

  // The active group is always read live from duplicateGroups, so deleting the
  // last extra (or dismissing) makes the modal close automatically.
  const activeGroup = selectedKey ? duplicateGroups.find((g) => g.key === selectedKey) ?? null : null

  const openDuplicateModal = (dup: { group: DuplicateGroup }) => setSelectedKey(dup.group.key)
  const closeModal = () => setSelectedKey(null)

  const handleDeleteItem = async (item: Transaction) => {
    if (item.id != null) {
      // Soft-delete so the removal of this duplicate propagates to Supabase and
      // other devices (a tombstone is recorded), instead of re-appearing on the
      // next pull. duplicateGroups recomputes from the live query; the modal
      // auto-closes once the group drops below 2 remaining entries.
      await softDeleteTransaction(item.id)
      void syncNow()
    }
  }

  const handleDismissGroup = () => {
    if (!selectedKey) return
    const next = Array.from(new Set([...dismissedKeys, selectedKey]))
    setDismissedKeys(next)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
    setSelectedKey(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-earth"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">History</h1>
        <div className="w-11" />
      </header>

      {/* Duplicate summary banner — only shows when there are flags to review */}
      {duplicateGroups.length > 0 && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <p className="text-sm font-medium">
            {duplicateGroups.length} possible duplicate{duplicateGroups.length === 1 ? "" : " groups"} found — tap a
            flagged entry to review.
          </p>
        </div>
      )}

      <div className="p-4">
        <TransactionList
          transactions={transactions}
          onEdit={setEditingTransaction}
          possibleDuplicates={flagged}
          onFlagClick={openDuplicateModal}
        />
      </div>

      {/* Duplicate review modal — lists every copy in the group */}
      {activeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4">
          <div className="w-full max-w-md bg-background rounded-3xl shadow-earth-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h2 className="text-xl font-bold">Possible Duplicate</h2>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{activeGroup.reason}</p>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {activeGroup.items.length} matching entries
              </p>
              {activeGroup.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 bg-card p-4 rounded-2xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">
                      {item.type === "in" ? "+" : "-"}${Number(item.amount).toFixed(2)} • {item.merchant || "Unknown"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.category} • {new Date(item.date).toLocaleDateString()}
                      {item.note ? ` • ${item.note}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive active:scale-95 transition-transform"
                    aria-label="Delete this entry"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border flex flex-col gap-3">
              <button
                onClick={handleDismissGroup}
                className="w-full py-4 bg-secondary text-foreground font-semibold rounded-2xl active:scale-95 transition-transform"
              >
                These aren&apos;t duplicates — keep all
              </button>
              <button
                onClick={closeModal}
                className="w-full py-4 bg-primary text-primary-foreground font-semibold rounded-2xl active:scale-95 transition-transform"
              >
                Done
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
