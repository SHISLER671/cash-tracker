import Dexie, { type EntityTable } from "dexie"

// Generate a stable UUID. Uses crypto.randomUUID when available (all modern
// mobile browsers, incl. Android Chrome) with a safe fallback.
export function genUuid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    // fall through to manual generation
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// A persistent per-device id, generated once and stored in localStorage. Used
// to tag rows so sync logs/debugging can tell which device created a record.
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server"
  try {
    let id = localStorage.getItem("device_id")
    if (!id) {
      id = genUuid()
      localStorage.setItem("device_id", id)
    }
    return id
  } catch {
    return "unknown-device"
  }
}

export interface Account {
  id?: number
  name: string
  owner: string
  type: "cash" | "bank" | "crypto"
  createdAt?: Date
}

export interface Transaction {
  id?: number
  uid?: string                // ← NEW: stable client-side UUID, shared identity with Supabase row id
  date: Date
  amount: number
  merchant?: string
  category: string
  type: "in" | "out"
  note?: string
  synced?: boolean
  lastSynced?: string         // ← NEW: ISO timestamp of last successful push/pull for this record
  deviceId?: string           // ← NEW: which device created the record
  accountId?: number          // ← NEW: links to Account
  accountType?: "cash" | "bank" | "crypto"  // ← NEW: for quick display
}

export interface Receipt {
  id?: number
  uid?: string                // ← NEW: stable client-side UUID
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

// A deletion record. When a transaction is deleted we hard-remove it from the
// `transactions` table (so every existing read query keeps working untouched)
// but record its uid here. The tombstone is what lets the deletion PROPAGATE:
// it is pushed to Supabase (sets shared_transactions.deleted = true) and it
// prevents a not-yet-deleted remote copy from resurrecting the row on the next
// pull. Keyed on uid so it survives across devices.
export interface Tombstone {
  uid: string          // == Supabase row id
  deletedAt: string    // ISO timestamp
  synced?: boolean      // has this deletion been pushed to Supabase yet?
}

export const db = new Dexie("CashTracker") as Dexie & {
  transactions: EntityTable<Transaction, "id">
  receipts: EntityTable<Receipt, "id">
  budgets: EntityTable<Budget, "id">
  presets: EntityTable<Preset, "id">
  accounts: EntityTable<Account, "id">     // ← NEW table
  tombstones: EntityTable<Tombstone, "uid">  // ← NEW: deletion records for sync
}

db.version(48).stores({                       // ← bumped from 47 to 48 (presets.order)
  transactions: "++id, date, amount, category, type, synced, merchant, accountId",
  receipts: "++id, createdAt, processed",
  budgets: "++id, month, category",
  presets: "++id, name, order",
  accounts: "++id, name, owner, type"
})

// v49: add a stable `uid` (UUID) index for transactions/receipts so local rows
// share identity with their Supabase counterpart. This is the key to making
// sync idempotent and preventing local duplicates. Existing rows are
// backfilled with a generated uid during the upgrade.
db.version(49)
  .stores({
    transactions: "++id, uid, date, amount, category, type, synced, merchant, accountId",
    receipts: "++id, uid, createdAt, processed",
    budgets: "++id, month, category",
    presets: "++id, name, order",
    accounts: "++id, name, owner, type",
  })
  .upgrade(async (tx) => {
    await tx
      .table("transactions")
      .toCollection()
      .modify((t: Transaction) => {
        if (!t.uid) t.uid = genUuid()
      })
    await tx
      .table("receipts")
      .toCollection()
      .modify((r: Receipt) => {
        if (!r.uid) r.uid = genUuid()
      })
  })

// v50: add the `tombstones` table so deletions can propagate across devices and
// Supabase instead of silently re-appearing on the next pull.
db.version(50).stores({
  transactions: "++id, uid, date, amount, category, type, synced, merchant, accountId",
  receipts: "++id, uid, createdAt, processed",
  budgets: "++id, month, category",
  presets: "++id, name, order",
  accounts: "++id, name, owner, type",
  tombstones: "uid, synced, deletedAt",
})

// Centralized auto-assignment of `uid` on every insert, regardless of which
// call site creates the record (transaction page, capture, inbox, edit modal,
// or a pull). This guarantees the requirement that every transaction/receipt
// has a unique client-side id "if not already present" — if the caller (e.g. a
// pull from Supabase) already supplied a uid, we keep it.
db.transactions.hook("creating", (_primKey, obj) => {
  if (!obj.uid) obj.uid = genUuid()
})
db.receipts.hook("creating", (_primKey, obj) => {
  if (!obj.uid) obj.uid = genUuid()
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

// Idempotent insert-or-update keyed on the stable `uid`. If a local row with
// the same uid already exists we update it in place instead of inserting a
// duplicate. Returns the local numeric id.
export const upsertTransactionByUid = async (tx: Transaction): Promise<number> => {
  if (!tx.uid) tx.uid = genUuid()
  const existing = await db.transactions.where("uid").equals(tx.uid).first()
  if (existing) {
    await db.transactions.update(existing.id!, { ...tx, id: existing.id })
    return existing.id!
  }
  return (await db.transactions.add(tx)) as number
}

// Soft-delete a transaction by its LOCAL numeric id. The row is removed from
// the transactions table (so all reads stay clean) and a tombstone is recorded
// so the deletion gets pushed to Supabase and never resurrects on pull. This is
// the ONLY way transactions should be deleted — never call db.transactions.delete
// directly, or the deletion won't sync.
export const softDeleteTransaction = async (localId: number): Promise<void> => {
  const t = await db.transactions.get(localId)
  if (!t) return
  await db.transaction("rw", db.transactions, db.tombstones, async () => {
    await db.transactions.delete(localId)
    if (t.uid) {
      await db.tombstones.put({
        uid: t.uid,
        deletedAt: new Date().toISOString(),
        synced: false,
      })
    }
  })
}

// Soft-delete every transaction matching a predicate (used by maintenance
// actions like "clear old data"). Each removed row gets a tombstone.
export const softDeleteTransactionsWhere = async (
  predicate: (t: Transaction) => boolean,
): Promise<number> => {
  const all = await db.transactions.toArray()
  const victims = all.filter(predicate)
  if (victims.length === 0) return 0
  const nowIso = new Date().toISOString()
  await db.transaction("rw", db.transactions, db.tombstones, async () => {
    for (const t of victims) {
      await db.transactions.delete(t.id!)
      if (t.uid) await db.tombstones.put({ uid: t.uid, deletedAt: nowIso, synced: false })
    }
  })
  return victims.length
}

export const getUnsyncedTombstones = async (): Promise<Tombstone[]> => {
  const all = await db.tombstones.toArray()
  return all.filter((t) => !t.synced)
}

export const hasTombstone = async (uid: string): Promise<boolean> => {
  return (await db.tombstones.get(uid)) !== undefined
}

// Wipes all synced data tables and resets the sync cursor so the next pull
// rebuilds local state from scratch. Intentionally preserves accounts, budgets
// and presets, which are NOT mirrored in Supabase and would otherwise be lost.
export const clearSyncedLocalData = async () => {
  await db.transaction("rw", db.transactions, db.receipts, db.tombstones, async () => {
    await db.transactions.clear()
    await db.receipts.clear()
    await db.tombstones.clear()
  })
  try {
    localStorage.removeItem("syncCursor")
    localStorage.removeItem("syncCursorV3")
    localStorage.removeItem("lastPulled")
  } catch {
    // ignore storage errors
  }
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
