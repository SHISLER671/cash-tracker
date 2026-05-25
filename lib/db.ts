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
}

export const db = new Dexie("CashTracker") as Dexie & {
  transactions: EntityTable<Transaction, "id">
  receipts: EntityTable<Receipt, "id">
  budgets: EntityTable<Budget, "id">
  presets: EntityTable<Preset, "id">
  accounts: EntityTable<Account, "id">     // ← NEW table
}

db.version(47).stores({                       // ← bumped from 46 to 47
  transactions: "++id, date, amount, category, type, synced, merchant, accountId",
  receipts: "++id, createdAt, processed",
  budgets: "++id, month, category",
  presets: "++id, name",
  accounts: "++id, name, owner, type"        // ← NEW store
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
    await db.presets.add({ name: trimmed })
  }
}

export const getAllPresets = async () => {
  return await db.presets.orderBy('name').toArray()
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
