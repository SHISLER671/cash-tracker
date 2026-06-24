"use client"

import { useState, useEffect } from "react"
import { db, type Transaction, addPresetIfNew, getAllPresets, softDeleteTransaction } from "@/lib/db"
import { scheduleSync } from "@/lib/supabase/sync"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

interface Props {
  transaction: Transaction | null
  onClose: () => void
  onSave: () => void
}

export default function EditTransactionModal({ transaction, onClose, onSave }: Props) {
  const [form, setForm] = useState<Transaction>({
    date: new Date(),
    amount: 0,
    merchant: "",
    category: "",
    type: "out",
    note: "",
    synced: false,
  })
  const [presets, setPresets] = useState<string[]>([])
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  useEffect(() => {
    if (transaction) {
      setForm({ ...transaction })
    }
  }, [transaction])

  useEffect(() => {
    getAllPresets().then(p => setPresets(p.map(preset => preset.name)))
  }, [])

  const handleSave = async () => {
    if (!form.amount || !form.merchant?.trim()) return

    // Mark unsynced so the change is pushed. We update the LOCAL row in place
    // (keeping its uid) and let syncNow() do an idempotent uid-keyed upsert to
    // Supabase. The old code did a blind insert here with a brand-new uuid on
    // every save, which spawned a duplicate remote row each time — the root
    // cause of the runaway duplicates.
    const updated: Transaction = { ...form, synced: false }

    if (updated.id !== undefined) {
      await db.transactions.update(updated.id, updated)
    } else {
      await db.transactions.add(updated)
    }

    // Auto-save category as preset if new
    await addPresetIfNew(updated.category)

    toast.success("Transaction saved!")
    onSave()
    onClose()

    // Push the edit + pull anything new (idempotent, uid-keyed).
    scheduleSync("edit-save")
  }

  const handleDelete = async () => {
    if (form.id === undefined) return

    // Soft-delete: removes the local row AND records a tombstone that syncNow()
    // pushes to Supabase (sets deleted=true), so the deletion propagates to
    // every device instead of the row re-appearing on the next pull.
    await softDeleteTransaction(form.id)
    scheduleSync("edit-delete")

    toast.error("Transaction deleted", {
      description: "This can be undone for 5 seconds",
      action: {
        label: "Undo",
        onClick: async () => {
          // Clear the tombstone and re-add as unsynced so syncNow() restores it
          // remotely (the uid-keyed upsert flips deleted back to false).
          if (form.uid) await db.tombstones.delete(form.uid)
          await db.transactions.add({ ...form, synced: false })
          toast.success("Transaction restored")
          onSave()
          scheduleSync("edit-restore")
        },
      },
      duration: 5000,
    })

    onClose()
  }

  const handleQuickCategory = (cat: string) => {
    setForm({ ...form, category: cat })
  }

  const handleAddNewCategory = async () => {
    if (newCategoryName.trim()) {
      await addPresetIfNew(newCategoryName.trim())
      const updated = await getAllPresets()
      setPresets(updated.map(p => p.name))
      setForm({ ...form, category: newCategoryName.trim() })
      setNewCategoryName("")
      setShowNewCategoryInput(false)
    }
  }

  if (!transaction) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-earth-lg overflow-hidden">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Edit Transaction</h2>

          <div className="space-y-5">
            {/* Amount */}
            <div>
              <label className="text-sm font-medium block mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                className="w-full p-4 rounded-2xl border text-3xl font-bold"
              />
            </div>

            {/* Merchant */}
            <div>
              <label className="text-sm font-medium block mb-1">Merchant / Store</label>
              <input
                type="text"
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                className="w-full p-4 rounded-2xl border"
              />
            </div>

            {/* Date + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Date</label>
                <input
                  type="date"
                  value={form.date.toISOString().split("T")[0]}
                  onChange={(e) => setForm({ ...form, date: new Date(e.target.value) })}
                  className="w-full p-4 rounded-2xl border"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as "in" | "out" })}
                  className="w-full p-4 rounded-2xl border"
                >
                  <option value="out">Spent (Out)</option>
                  <option value="in">Received (In)</option>
                </select>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-medium block mb-1">Category</label>
              <input
                type="text"
                value={form.category}
                placeholder="food, gas, coffee..."
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full p-4 rounded-2xl border"
              />
            </div>

            {/* Quick Category Presets */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">QUICK CATEGORIES</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleQuickCategory(cat)}
                    className={`px-3 py-1.5 rounded-2xl text-sm font-medium transition-colors ${
                      form.category === cat 
                        ? "bg-black text-white" 
                        : "bg-secondary hover:bg-primary/10"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowNewCategoryInput(true)}
                  className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-2xl text-sm font-medium"
                >
                  + New
                </button>
              </div>

              {showNewCategoryInput && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. pet food"
                    className="flex-1 px-4 py-2 border rounded-2xl text-sm"
                  />
                  <button 
                    type="button"
                    onClick={handleAddNewCategory} 
                    className="px-4 bg-black text-white rounded-2xl text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Note / Memo</label>
              <textarea
                value={form.note || ""}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full p-4 rounded-2xl border h-28"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={handleDelete}
              className="flex-1 py-5 bg-red-100 hover:bg-red-200 text-red-600 rounded-3xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Trash2 className="h-5 w-5" />
              Delete
            </button>

            <button
              onClick={handleSave}
              className="flex-1 py-5 bg-black text-white rounded-3xl font-semibold active:scale-95 transition-all"
            >
              Save Changes
            </button>
          </div>

          <button onClick={onClose} className="w-full mt-4 text-gray-500 py-3 font-medium">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
