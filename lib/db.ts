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
  processed: number // 0 = unprocessed, 1 = processed
}

// Create DB
export const db = new Dexie('CashTracker') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  receipts: EntityTable<Receipt, 'id'>
}

// High version number so it safely upgrades your existing DB
db.version(31).stores({
  transactions: '++id, date, amount, category, type, synced',
  receipts: '++id, createdAt, processed'
})

// Receipt helpers (exactly what capture + inbox pages expect)
export const addReceiptToInbox = async (receipt: Omit<Receipt, 'id' | 'createdAt'>) => {
  return await db.receipts.add({
    ...receipt,
    createdAt: new Date(),
    processed: 0
  })
}

export const markReceiptProcessed = async (id: number, category: string) => {
  return await db.receipts.update(id, { processed: 1, category })
}

export const bulkMarkReceiptsProcessed = async (ids: number[], category: string) => {
  return await db.receipts.bulkUpdate(
    ids.map(id => ({ key: id, changes: { processed: 1, category } }))
  )
}

export const deleteReceipt = async (id: number) => {
  return await db.receipts.delete(id)
}

export const bulkDeleteReceipts = async (ids: number[]) => {
  return await db.receipts.bulkDelete(ids)
}

export type { Transaction, Receipt }
