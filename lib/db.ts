import Dexie, { type EntityTable } from 'dexie'

export interface Transaction {
  id?: number
  date: Date
  amount: number
  merchant: string
  category: string
  type: 'in' | 'out'
  note?: string
  synced?: boolean
}

export interface Receipt {
  id?: number
  imageData: string
  amount: number
  merchant?: string
  category?: string
  createdAt: Date
  processed: number
}

export interface Budget {
  id?: number
  month: string
  category: string
  limit: number
}

export const db = new Dexie('CashTracker') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  receipts: EntityTable<Receipt, 'id'>
  budgets: EntityTable<Budget, 'id'>
}

db.version(36).stores({
  transactions: '++id, date, amount, category, type, synced',
  receipts: '++id, createdAt, processed',
  budgets: '++id, month, category'
})

// Receipt helpers
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

// Draft helpers
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

export type { Transaction, Receipt, Budget }
