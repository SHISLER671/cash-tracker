import Dexie, { type EntityTable } from 'dexie'

export interface Transaction {
  id?: number
  date: Date
  amount: number
  merchant: string
  category: string          // now free-text
  type: 'in' | 'out'
  note?: string
  synced?: boolean          // new: helps track local-only changes
}

export const db = new Dexie('CashTracker') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
}

db.version(2).stores({
  transactions: '++id, date, amount, category, type, synced'
})

// Optional: migrate old data
db.on('ready', async () => {
  const count = await db.transactions.count()
  if (count > 0) {
    await db.transactions.toCollection().modify(t => {
      if (!t.synced) t.synced = false
      if (!t.merchant) t.merchant = 'Unknown'
    })
  }
})

export type { Transaction }
