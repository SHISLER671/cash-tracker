import Dexie, { type EntityTable } from "dexie"

export interface Account {
  id?: number
  name: string
  owner: string
  type: "cash" | "bank" | "crypto"
  createdAt?: Date
}

export interface Transaction {
  id?: number
  date: Date
  amount: number
  merchant?: string
  category: string
  type: "in" | "out"
  note?: string
  synced?: boolean
  accountId?: number          // ← NEW: links to Account
  accountType?: "cash" | "bank" | "crypto"  // ← NEW: for quick display
}

export interface Receipt {
  id?: number
  imageData: string
  createdAt: Date
  processed: 0 | 1
  amount?: number
  merchant?: string
  date?: string
  category?: string
}

export interface Budget {
  id?: number
  month: string
  category: string
  limit: number
}

export interface Preset {
  id?: number
  name: string
  order?: number
}

export const db = new Dexie("CashTracker") as Dexie & {
  transactions: EntityTable<Transaction, "id">
  receipts: EntityTable<Receipt, "id">
  budgets: EntityTable<Budget, "id">
  presets: EntityTable<Preset, "id">
  accounts: EntityTable<Account, "id">     // ← NEW table
}

db.version(48).stores({                       // ← bumped from 47 to 48 (presets.order)
  transactions: "++id, date, amount, category, type, synced, merchant, accountId",
  receipts: "++id, createdAt, processed",
  budgets: "++id, month, category",
  presets: "++id, name, order",
  accounts: "++id, name, owner, type"
})

// Rest of your helper functions stay exactly the same
export const addReceiptToInbox = async (receipt: Omit<Receipt, 'id' | 'createdAt'>) => {
  return await db.receipts.add({ ...receipt, createdAt: new Date(), processed: 0 })
}

export const markReceiptProcessed = async (id: number, category: string) => {
  return await db.receipts.update(id, { processed: 1, category })
}

export const bulkMarkReceiptsProcessed = async (ids: number[], category: string) => {
  return await db.receipts.bulkUpdate(
    ids.map(id => ({ key: id, changes: { processed: 1, category } }))
  )
}

export const deleteReceipt = async (id: number) => await db.receipts.delete(id)
export const bulkDeleteReceipts = async (ids: number[]) => await db.receipts.bulkDelete(ids)

export const addPresetIfNew = async (name: string) => {
  if (!name?.trim()) return
  const trimmed = name.trim()
  const existing = await db.presets.where('name').equalsIgnoreCase(trimmed).first()
  if (!existing) {
    const all = await db.presets.toArray()
    const maxOrder = all.reduce((m, p) => Math.max(m, p.order ?? -1), -1)
    await db.presets.add({ name: trimmed, order: maxOrder + 1 })
  }
}

export const getAllPresets = async () => {
  return await db.presets.orderBy('name').toArray()
}

// Presets ordered by their saved `order` (JS sort avoids Dexie index gaps for
// records created before the order field existed).
export const getOrderedPresets = async (): Promise<Preset[]> => {
  const all = await db.presets.toArray()
  return all.sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
  )
}

// Idempotent: makes sure the default categories exist as presets and that every
// preset has a stable `order`. Safe to call on every mount.
export const seedDefaultPresets = async (defaults: string[]) => {
  for (const name of defaults) {
    const existing = await db.presets.where('name').equalsIgnoreCase(name).first()
    if (!existing) {
      await db.presets.add({ name })
    }
  }

  const all = await db.presets.toArray()
  if (all.every((p) => p.order !== undefined)) return // already ordered, nothing to do

  const lower = (s: string) => s.toLowerCase()
  const defaultIndex = (name: string) => {
    const i = defaults.findIndex((d) => lower(d) === lower(name))
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const sorted = [...all].sort((a, b) => {
    const da = defaultIndex(a.name)
    const dbi = defaultIndex(b.name)
    if (da !== dbi) return da - dbi
    return a.name.localeCompare(b.name)
  })
  await db.transaction('rw', db.presets, async () => {
    await Promise.all(sorted.map((p, idx) => db.presets.update(p.id!, { order: idx })))
  })
}

export const renamePreset = async (
  id: number,
  newName: string,
): Promise<{ ok: true } | { ok: false; reason: "empty" | "duplicate" }> => {
  const trimmed = newName.trim()
  if (!trimmed) return { ok: false, reason: "empty" }
  const clash = await db.presets.where('name').equalsIgnoreCase(trimmed).first()
  if (clash && clash.id !== id) return { ok: false, reason: "duplicate" }
  await db.presets.update(id, { name: trimmed })
  return { ok: true }
}

export const deletePreset = async (id: number) => {
  await db.presets.delete(id)
}

// Persist a new ordering. `orderedIds` is the full list of preset ids in their
// desired display order. Uses bulkUpdate so existing names are preserved.
export const reorderPresets = async (orderedIds: number[]) => {
  await db.transaction('rw', db.presets, async () => {
    await Promise.all(orderedIds.map((id, idx) => db.presets.update(id, { order: idx })))
  })
}

export const saveDraft = async (draft: Partial<Transaction>) => {
  localStorage.setItem('transaction_draft', JSON.stringify(draft))
}
export const getDraft = async (): Promise<Partial<Transaction> | null> => {
  const saved = localStorage.getItem('transaction_draft')
  return saved ? JSON.parse(saved) : null
}
export const clearDraft = async () => {
  localStorage.removeItem('transaction_draft')
}

export type { Transaction, Receipt, Budget, Preset, Account }
