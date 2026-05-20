'use client'

import { useState, useEffect } from 'react'
import { db, type Transaction } from '@/lib/db'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  transaction: Transaction | null
  onClose: () => void
  onSave: () => void
}

export default function EditTransactionModal({ transaction, onClose, onSave }: Props) {
  const [form, setForm] = useState<Transaction>({
    date: new Date(),
    amount: 0,
    merchant: '',
    category: '',
    type: 'out',
    note: '',
    synced: false,
  })

  useEffect(() => {
    if (transaction) setForm({ ...transaction })
  }, [transaction])

  const handleSave = async () => {
    if (!form.amount || !form.merchant?.trim()) return

    const updated: Transaction = { ...form, synced: false }

    if (updated.id !== undefined) {
      await db.transactions.update(updated.id, updated)
    } else {
      await db.transactions.add(updated)
    }

    // Push to Supabase (if configured)
    try {
      if (supabase) {
        await supabase.from('shared_transactions').insert({
          date: updated.date.toISOString(),
          amount: updated.amount,
          category: updated.category,
          type: updated.type,
          note: updated.note || null,
          device_id: `edit-${Date.now()}`,
        })
      }
    } catch (e) {
      console.warn('Supabase push delayed', e)
    }

    toast.success('Transaction saved!')
    onSave()
    onClose()
  }

  const handleDelete = async () => {
    if (form.id === undefined) return

    await db.transactions.delete(form.id)

    toast.error('Transaction deleted', {
      description: 'This can be undone for 5 seconds',
      action: {
        label: 'Undo',
        onClick: async () => {
          await db.transactions.add(form)
          toast.success('Transaction restored')
          onSave()
        },
      },
      duration: 5000,
    })

    onClose()
  }

  if (!transaction) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] overflow-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Edit Transaction</h2>

          <div className="space-y-5">
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

            <div>
              <label className="text-sm font-medium block mb-1">Merchant / Store</label>
              <input
                type="text"
                value={form.merchant}
                onChange={(e) => setForm({ ...form, merchant: e.target.value })}
                className="w-full p-4 rounded-2xl border"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Date</label>
                <input
                  type="date"
                  value={form.date.toISOString().split('T')[0]}
                  onChange={(e) => setForm({ ...form, date: new Date(e.target.value) })}
                  className="w-full p-4 rounded-2xl border"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'in' | 'out' })}
                  className="w-full p-4 rounded-2xl border"
                >
                  <option value="out">Spent (Out)</option>
                  <option value="in">Received (In)</option>
                </select>
              </div>
            </div>

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

            <div>
              <label className="text-sm font-medium block mb-1">Note / Memo</label>
              <textarea
                value={form.note || ''}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full p-4 rounded-2xl border h-28"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={handleDelete}
              className="flex-1 py-5 bg-red-100 hover:bg-red-200 text-red-600 rounded-3xl font-semibold"
            >
              Delete
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-5 bg-black text-white rounded-3xl font-semibold active:scale-95"
            >
              Save Changes
            </button>
          </div>

          <button onClick={onClose} className="w-full mt-4 text-gray-500 py-3">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
