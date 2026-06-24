import {
  db,
  genUuid,
  getDeviceId,
  clearSyncedLocalData,
  getUnsyncedTombstones,
  type Transaction,
} from "@/lib/db"
import { supabase } from "./client"
import type { SharedTransactionRow } from "./types"

// Incremental pull cursor. Keyed on the server's `updated_at` (bumped by a DB
// trigger on every insert/update), so edits AND deletes are caught — not just
// new rows.
const CURSOR_KEY = "syncCursorV3"

export type SyncState = "idle" | "syncing" | "synced" | "error" | "offline"

export type SyncResult = {
  ok: boolean
  pushed: number
  deleted: number
  error?: string
}

export type SyncStatus = {
  lastPushed: string | null
  lastPulled: string | null
  pendingCount: number
}

type SyncEvent =
  | { type: "start" }
  | { type: "complete"; result: SyncResult }
  | { type: "error"; error: string }

const syncListeners = new Set<(event: SyncEvent) => void>()

export function subscribeSync(listener: (event: SyncEvent) => void): () => void {
  syncListeners.add(listener)
  return () => syncListeners.delete(listener)
}

function emitSync(event: SyncEvent) {
  syncListeners.forEach((l) => l(event))
}

function log(...args: unknown[]) {
  const device = getDeviceId().slice(0, 8)
  console.log(`[v0][sync ${device} @ ${new Date().toISOString()}]`, ...args)
}

let syncInFlight: Promise<SyncResult> | null = null
let lastSyncError: string | null = null

function sameTransaction(local: Transaction, remote: SharedTransactionRow): boolean {
  const localDay = local.date.toISOString().split("T")[0]
  const remoteDay = new Date(remote.date).toISOString().split("T")[0]
  return (
    localDay === remoteDay &&
    Number(local.amount) === Number(remote.amount) &&
    local.category.toLowerCase() === (remote.category || "").toLowerCase() &&
    local.type === remote.type &&
    (local.accountId ?? null) === (remote.account_id ?? null)
  )
}

export async function pushToPartner(opts: { force?: boolean } = {}): Promise<number> {
  if (!supabase) return 0

  const deviceId = getDeviceId()
  const source = await db.transactions.toArray()
  const toPush = source.filter((t) => Boolean(t.id) && (opts.force || !t.synced))
  log(`push: ${toPush.length} row(s)${opts.force ? " (force)" : " unsynced"}`)

  let pushed = 0
  for (const t of toPush) {
    const uid = t.uid ?? genUuid()
    if (!t.uid) {
      await db.transactions.update(t.id as number, { uid })
    }

    const { error } = await supabase.from("shared_transactions").upsert(
      {
        id: uid,
        date: t.date.toISOString(),
        amount: t.amount,
        merchant: t.merchant || null,
        category: t.category,
        type: t.type,
        note: t.note || null,
        account_id: t.accountId ?? null,
        device_id: deviceId,
        deleted: false,
      },
      { onConflict: "id" },
    )

    if (!error) {
      await db.transactions.update(t.id as number, {
        synced: true,
        lastSynced: new Date().toISOString(),
      })
      localStorage.setItem("lastPushed", new Date().toISOString())
      pushed++
      log(`push ok uid=${uid.slice(0, 8)} amount=${t.amount} ${t.category}`)
    } else {
      console.error("[v0][sync] push failed for transaction:", error, t)
      throw new Error(error.message)
    }
  }
  return pushed
}

export async function pushDeletions(): Promise<number> {
  if (!supabase) return 0

  const tombstones = await getUnsyncedTombstones()
  if (tombstones.length === 0) return 0
  log(`push deletions: ${tombstones.length} tombstone(s)`)

  let deleted = 0
  for (const ts of tombstones) {
    const { error } = await supabase
      .from("shared_transactions")
      .update({ deleted: true })
      .eq("id", ts.uid)

    if (!error) {
      await db.tombstones.update(ts.uid, { synced: true })
      deleted++
      log(`deletion synced uid=${ts.uid.slice(0, 8)}`)
    } else {
      console.error("[v0][sync] deletion push failed:", error, ts)
      throw new Error(error.message)
    }
  }
  return deleted
}

export async function pullFromPartner(opts: { full?: boolean } = {}): Promise<void> {
  if (!supabase) return

  const cursor = opts.full ? null : localStorage.getItem(CURSOR_KEY)
  log(`pull started${opts.full ? " (full)" : cursor ? ` (since ${cursor})` : " (initial)"}`)

  let query = supabase
    .from("shared_transactions")
    .select("*")
    .order("updated_at", { ascending: true })

  if (cursor) query = query.gt("updated_at", cursor)

  const { data, error } = await query

  if (error || !data) {
    console.error("[v0][sync] pull error:", error)
    throw new Error(error?.message ?? "Pull failed")
  }

  const rows = data as SharedTransactionRow[]
  log(`pull fetched ${rows.length} remote row(s)`)
  if (rows.length === 0) {
    localStorage.setItem("lastPulled", new Date().toISOString())
    return
  }

  let inserted = 0
  let updated = 0
  let healed = 0
  let removed = 0
  const claimedLocalIds = new Set<number>()
  let maxUpdatedAt = cursor || ""

  await db.transaction("rw", db.transactions, db.tombstones, async () => {
    const existing = await db.transactions.toArray()
    const tombstoneUids = new Set((await db.tombstones.toArray()).map((t) => t.uid))
    const byUid = new Map<string, Transaction>()
    for (const local of existing) {
      if (local.uid) byUid.set(local.uid, local)
    }

    for (const remote of rows) {
      if (remote.updated_at && remote.updated_at > maxUpdatedAt) {
        maxUpdatedAt = remote.updated_at
      }

      const remoteUid = remote.id
      const nowIso = new Date().toISOString()

      if (remote.deleted) {
        const local = byUid.get(remoteUid)
        if (local) {
          await db.transactions.delete(local.id!)
          byUid.delete(remoteUid)
          removed++
        }
        await db.tombstones.put({ uid: remoteUid, deletedAt: nowIso, synced: true })
        continue
      }

      if (tombstoneUids.has(remoteUid)) continue

      const mapped: Transaction = {
        uid: remoteUid,
        date: new Date(remote.date),
        amount: Number(remote.amount),
        merchant: remote.merchant || "",
        category: remote.category || "other",
        type: remote.type,
        note: remote.note || undefined,
        synced: true,
        lastSynced: nowIso,
        deviceId: remote.device_id || undefined,
        accountId: remote.account_id ?? undefined,
        accountType: "cash",
      }

      const uidMatch = byUid.get(remoteUid)
      if (uidMatch) {
        await db.transactions.update(uidMatch.id!, { ...mapped, id: uidMatch.id })
        updated++
        continue
      }

      const legacy = existing.find(
        (l) =>
          l.id !== undefined &&
          !claimedLocalIds.has(l.id) &&
          !byUid.has(l.uid ?? "") &&
          sameTransaction(l, remote),
      )
      if (legacy) {
        claimedLocalIds.add(legacy.id!)
        byUid.set(remoteUid, { ...legacy, uid: remoteUid })
        await db.transactions.update(legacy.id!, { ...mapped, id: legacy.id })
        healed++
        continue
      }

      const newId = (await db.transactions.add(mapped)) as number
      byUid.set(remoteUid, { ...mapped, id: newId })
      inserted++
    }
  })

  if (maxUpdatedAt) localStorage.setItem(CURSOR_KEY, maxUpdatedAt)
  localStorage.setItem("lastPulled", new Date().toISOString())
  log(`pull done: inserted=${inserted} updated=${updated} healed=${healed} removed=${removed}`)
}

export async function syncNow(opts: { full?: boolean; force?: boolean } = {}): Promise<SyncResult> {
  if (!supabase) {
    return { ok: false, pushed: 0, deleted: 0, error: "Supabase not configured" }
  }

  if (syncInFlight) {
    log("syncNow: already in flight, awaiting existing run")
    return syncInFlight
  }

  emitSync({ type: "start" })

  syncInFlight = (async (): Promise<SyncResult> => {
    try {
      const pushed = await pushToPartner({ force: opts.force })
      const deleted = await pushDeletions()
      await pullFromPartner({ full: opts.full })
      lastSyncError = null
      const result: SyncResult = { ok: true, pushed, deleted }
      emitSync({ type: "complete", result })
      return result
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed"
      lastSyncError = message
      console.error("[v0][sync] syncNow error:", e)
      const result: SyncResult = { ok: false, pushed: 0, deleted: 0, error: message }
      emitSync({ type: "error", error: message })
      return result
    }
  })()

  try {
    return await syncInFlight
  } finally {
    syncInFlight = null
  }
}

/** Fire-and-forget sync after a local mutation. Never blocks UI. */
export function scheduleSync(reason?: string): void {
  void syncNow().catch((e) =>
    console.error("[v0][sync] scheduled sync failed:", reason, e),
  )
}

export async function clearLocalDataAndResync(): Promise<void> {
  log("full resync: clearing local synced data")
  await clearSyncedLocalData()
  await pullFromPartner({ full: true })
  log("full resync: complete")
}

export async function getPendingPushCount(): Promise<number> {
  const [transactions, tombstones] = await Promise.all([
    db.transactions.toArray(),
    getUnsyncedTombstones(),
  ])
  const unsyncedTx = transactions.filter((t) => t.synced !== true).length
  return unsyncedTx + tombstones.length
}

export function getSyncStatus(): SyncStatus {
  return {
    lastPushed: localStorage.getItem("lastPushed"),
    lastPulled: localStorage.getItem("lastPulled"),
    pendingCount: 0,
  }
}

export function getLastSyncError(): string | null {
  return lastSyncError
}

export async function autoPullIfNeeded(): Promise<void> {
  await syncNow()
}