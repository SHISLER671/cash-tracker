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

const db = new Dexie('CashTracker') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  budgets: EntityTable<Budget, 'month'>;
};

db.version(1).stores({
  transactions: '++id, date, category, type',
  budgets: '[month+category], month, category'
});

export { db };
