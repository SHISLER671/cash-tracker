import Dexie, { type EntityTable } from 'dexie';

export interface Transaction {
  id?: number;
  date: Date;
  category: 'gas' | 'food' | 'medical' | 'other';
  type: 'in' | 'out';
  amount: number;
  note?: string;
}

export interface Budget {
  month: string; // Format: YYYY-MM
  category: 'gas' | 'food' | 'medical' | 'other';
  limit: number;
}

export interface Draft {
  id?: number;
  step: 1 | 2 | 3;
  type: 'in' | 'out';
  amount: number;
  category?: 'gas' | 'food' | 'medical' | 'other';
  note?: string;
  updatedAt: Date;
}

export interface Receipt {
  id?: number;
  imageData: string; // Base64 image
  amount: number;
  rawText?: string;
  category?: 'gas' | 'food' | 'medical' | 'other';
  processed: boolean;
  createdAt: Date;
}

const db = new Dexie('CashTracker') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  budgets: EntityTable<Budget, 'month'>;
  drafts: EntityTable<Draft, 'id'>;
  receipts: EntityTable<Receipt, 'id'>;
};

db.version(3).stores({
  transactions: '++id, date, category, type',
  budgets: '[month+category], month, category',
  drafts: '++id, updatedAt',
  receipts: '++id, processed, createdAt, category'
});

export { db };

// Draft management helpers
export async function saveDraft(draft: Omit<Draft, 'id' | 'updatedAt'>) {
  // Clear existing drafts and save new one
  await db.drafts.clear();
  await db.drafts.add({
    ...draft,
    updatedAt: new Date()
  });
}

export async function getDraft(): Promise<Draft | undefined> {
  const drafts = await db.drafts.toArray();
  return drafts[0];
}

export async function clearDraft() {
  await db.drafts.clear();
}

// Receipt inbox helpers
export async function addReceiptToInbox(receipt: Omit<Receipt, 'id' | 'createdAt' | 'processed'>) {
  return await db.receipts.add({
    ...receipt,
    processed: false,
    createdAt: new Date()
  });
}

export async function getUnprocessedReceipts(): Promise<Receipt[]> {
  return await db.receipts.where('processed').equals(0).toArray();
}

export async function markReceiptProcessed(id: number, category: 'gas' | 'food' | 'medical' | 'other') {
  const receipt = await db.receipts.get(id);
  if (receipt && receipt.amount > 0) {
    // Create transaction from receipt
    await db.transactions.add({
      date: receipt.createdAt,
      category,
      type: 'out',
      amount: receipt.amount,
      note: 'Receipt scan',
    });
    // Mark receipt as processed
    await db.receipts.update(id, { processed: true, category });
  }
}

export async function bulkMarkReceiptsProcessed(ids: number[], category: 'gas' | 'food' | 'medical' | 'other') {
  for (const id of ids) {
    await markReceiptProcessed(id, category);
  }
}

export async function deleteReceipt(id: number) {
  await db.receipts.delete(id);
}

export async function bulkDeleteReceipts(ids: number[]) {
  await db.receipts.bulkDelete(ids);
}
