"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeft, Inbox, Trash2, Check, X } from "lucide-react"
import { db, markReceiptProcessed, bulkMarkReceiptsProcessed, deleteReceipt, bulkDeleteReceipts, type Receipt } from "@/lib/db"
import { formatDistanceToNow } from "date-fns"
import EditTransactionModal from "@/components/EditTransactionModal"

type Category = "gas" | "food" | "medical" | "other"

const categoryConfig = {
  gas: { label: "GAS", color: "bg-primary", textColor: "text-primary" },
  food: { label: "FOOD", color: "bg-income", textColor: "text-income" },
  medical: { label: "MED", color: "bg-expense", textColor: "text-expense" },
  other: { label: "OTHER", color: "bg-muted-foreground", textColor: "text-muted-foreground" },
}

export default function InboxPage() {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)

  const receipts = useLiveQuery(async () => {
    return await db.receipts.where('processed').equals(0).reverse().sortBy('createdAt')
  }, [])

  const unprocessedCount = receipts?.length ?? 0

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    if (selectedIds.size === unprocessedCount) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(receipts?.map(r => r.id!) ?? []))
    }
  }

  const handleApplyCategory = async (category: Category) => {
    if (selectedIds.size === 0) return
    setIsProcessing(true)
    await bulkMarkReceiptsProcessed(Array.from(selectedIds), category)
    setSelectedIds(new Set())
    setShowCategoryPicker(false)
    setIsProcessing(false)
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    setIsProcessing(true)
    await bulkDeleteReceipts(Array.from(selectedIds))
    setSelectedIds(new Set())
    setIsProcessing(false)
  }

  const handleSingleCategorize = async (id: number, category: Category) => {
    setIsProcessing(true)
    await markReceiptProcessed(id, category)
    setIsProcessing(false)
  }

  const handleSingleDelete = async (id: number) => {
    setIsProcessing(true)
    await deleteReceipt(id)
    setIsProcessing(false)
  }

  const openEditFromReceipt = (receipt: Receipt) => {
    setEditingReceipt(receipt)
  }

  const handleModalSave = () => {
    setEditingReceipt(null)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border py-4">
          <button onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-earth transition-all hover:bg-secondary active:scale-95 active:bg-primary/20">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">
            INBOX {unprocessedCount > 0 && `(${unprocessedCount})`}
          </h1>
          <div className="w-11" />
        </header>

        {/* Selection bar */}
        {unprocessedCount > 0 && (
          <div className="flex items-center justify-between py-3 border-b border-border">
            <button onClick={selectAll} className="text-sm font-medium text-primary">
              {selectedIds.size === unprocessedCount ? "Deselect All" : "Select All"}
            </button>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowCategoryPicker(true)} disabled={isProcessing} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-income text-white text-sm font-semibold transition-all hover:brightness-95 active:scale-95 disabled:opacity-50">
                  <Check className="h-4 w-4" />
                  Apply ({selectedIds.size})
                </button>
                <button onClick={handleDeleteSelected} disabled={isProcessing} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-expense text-white text-sm font-semibold transition-all hover:brightness-95 active:scale-95 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Receipt list */}
        <div className="flex-1 py-4">
          {unprocessedCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-card shadow-earth mb-4">
                <Inbox className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1">Inbox Empty</h2>
              <p className="text-sm text-muted-foreground text-center">Capture receipts to add them here for categorization</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {receipts?.map((receipt) => (
                <ReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  isSelected={selectedIds.has(receipt.id!)}
                  onToggleSelect={() => toggleSelect(receipt.id!)}
                  onCategorize={(cat) => handleSingleCategorize(receipt.id!, cat)}
                  onDelete={() => handleSingleDelete(receipt.id!)}
                  onEdit={() => openEditFromReceipt(receipt)}
                  disabled={isProcessing}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Category picker modal */}
      {showCategoryPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-card p-6 shadow-earth-lg animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">Apply to {selectedIds.size} receipt{selectedIds.size !== 1 ? 's' : ''}</h3>
              <button onClick={() => setShowCategoryPicker(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-all hover:bg-muted active:scale-95">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(Object.entries(categoryConfig) as [Category, typeof categoryConfig.gas][]).map(([cat, config]) => (
                <button
                  key={cat}
                  onClick={() => handleApplyCategory(cat)}
                  disabled={isProcessing}
                  className={`flex items-center justify-center gap-2 py-4 rounded-xl ${config.color} text-white font-semibold transition-all hover:brightness-95 active:scale-98 disabled:opacity-50`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditTransactionModal
        transaction={editingReceipt ? {
          id: undefined,
          date: editingReceipt.createdAt || new Date(),
          amount: editingReceipt.amount || 0,
          merchant: editingReceipt.merchant || "Unknown",
          category: editingReceipt.category || "",
          type: "out",
          note: "",
          synced: false,
        } : null}
        onClose={() => setEditingReceipt(null)}
        onSave={handleModalSave}
      />
    </div>
  )
}

// Updated ReceiptCard – whole card is now clickable
function ReceiptCard({
  receipt,
  isSelected,
  onToggleSelect,
  onCategorize,
  onDelete,
  onEdit,
  disabled,
}: {
  receipt: Receipt
  isSelected: boolean
  onToggleSelect: () => void
  onCategorize: (category: Category) => void
  onDelete: () => void
  onEdit: () => void
  disabled: boolean
}) {
  return (
    <div
      onClick={onEdit}
      className={`flex gap-3 rounded-xl bg-card p-3 shadow-earth cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : ""}`}
    >
      {/* Checkbox */}
      <button onClick={(e) => { e.stopPropagation(); onToggleSelect() }} className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition-all ${isSelected ? "border-primary bg-primary text-white" : "border-border bg-card"}`}>
        {isSelected && <Check className="h-4 w-4" />}
      </button>

      {/* Thumbnail */}
      <div className="w-16 h-20 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
        {receipt.imageData ? (
          <img src={receipt.imageData} alt="Receipt" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold text-foreground">${receipt.amount.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{formatDistanceToNow(receipt.createdAt, { addSuffix: true })}</p>
          </div>
        </div>

        {/* Quick category buttons */}
        <div className="flex gap-1 mt-2">
          {(Object.entries(categoryConfig) as [Category, typeof categoryConfig.gas][]).map(([cat, config]) => (
            <button
              key={cat}
              onClick={(e) => { e.stopPropagation(); onCategorize(cat) }}
              disabled={disabled}
              className={`px-2 py-1 rounded text-xs font-semibold ${config.textColor} bg-secondary transition-all hover:brightness-95 active:scale-95 disabled:opacity-50`}
            >
              {config.label}
            </button>
          ))}
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} disabled={disabled} className="px-2 py-1 rounded text-xs font-semibold text-expense bg-secondary transition-all hover:brightness-95 active:scale-95 disabled:opacity-50">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
