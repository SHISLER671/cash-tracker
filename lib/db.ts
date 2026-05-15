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

const db = new Dexie('CashTracker') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  budgets: EntityTable<Budget, 'month'>;
  drafts: EntityTable<Draft, 'id'>;
};

db.version(2).stores({
  transactions: '++id, date, category, type',
  budgets: '[month+category], month, category',
  drafts: '++id, updatedAt'
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
