'use client'

import { useState, useEffect } from 'react'
import { db, type Transaction } from '@/lib/db'
import { supabase } from '@/lib/supabase/client'

interface Props {
  transaction: Transaction | null
  onClose: () => void
  onSave: (updated: Transaction) => void
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
    if (transaction) setForm(transaction)
  }, [transaction])

  const handleSave = async () => {
    if (!form.amount || !form.merchant) return

    const updated = { ...form, synced: false }

    // Update local Dexie immediately
    if (updated.id) {
      await db.transactions.update(updated.id, updated)
    } else {
      await db.transactions.add(updated)
    }

    // Push to Supabase
    try {
      const payload = {
        date: updated.date.toISOString(),
        amount: updated.amount,
        category: updated.category,
        type: updated.type,
        note: updated.note || null,
        device_id: `edit-${Date.now()}`
      }

      if (updated.id) {
        // For existing Supabase rows we would need the Supabase ID, but for simplicity we just insert a new one
        // (you can improve this later with a supabase_id column if you want true updates)
        await supabase.from('shared_transactions').insert(payload)
      } else {
        await supabase.from('shared_transactions').insert(payload)
      }
    } catch (e) {
      console.warn('Supabase push failed (will sync later)', e)
    }

    onSave(updated)
    onClose()
  }

  const handleDelete = async () => {
    if (!form.id) return
    await db.transactions.delete(form.id)
    // TODO: delete from Supabase if you want (optional for now)
    onClose()
  }

  if (!transaction) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold mb-6">Edit Transaction</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              className="w-full p-3 border rounded-2xl"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Merchant</label>
            <input
              type="text"
              value={form.merchant}
              onChange={e => setForm({ ...form, merchant: e.target.value })}
              className="w-full p-3 border rounded-2xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Date</label>
              <input
                type="date"
                value={form.date.toISOString().split('T')[0]}
                onChange={e => setForm({ ...form, date: new Date(e.target.value) })}
                className="w-full p-3 border rounded-2xl"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Type</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value as 'in' | 'out' })}
                className="w-full p-3 border rounded-2xl"
              >
                <option value="out">Out (spent)</option>
                <option value="in">In (received)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Category</label>
            <input
              type="text"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              placeholder="food, gas, medical, coffee, etc."
              className="w-full p-3 border rounded-2xl"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Note</label>
            <textarea
              value={form.note || ''}
              onChange={e => setForm({ ...form, note: e.target.value })}
              className="w-full p-3 border rounded-2xl h-24"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={handleDelete}
            className="flex-1 py-4 bg-red-100 text-red-600 rounded-3xl font-medium"
          >
            Delete
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-4 bg-black text-white rounded-3xl font-medium"
          >
            Save Changes
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-gray-500"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
