import { createClient } from '@supabase/supabase-js'
import {
  db,
  genUuid,
  getDeviceId,
  clearSyncedLocalData,
  type Transaction,
} from '@/lib/db'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Only create the client when both env vars exist. This prevents the entire
// app from crashing at import time if the keys are missing or not yet injected.
export const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

if (!supabase) {
  console.warn("[sync] Supabase env vars missing — sync features are disabled.")
}

// ---------------------------------------------------------------------------
// Logging helper — every sync log is tagged with the device id + timestamp so
// multi-device duplicate issues are easy to trace across phones.
// ---------------------------------------------------------------------------
function log(...args: unknown[]) {
  const device = getDeviceId().slice(0, 8)
  console.log(`[v0][sync ${device} @ ${new Date().toISOString()}]`, ...args)
}

// Guards against concurrent pulls. autoPullIfNeeded fires on multiple page
// mounts (and twice under React strict mode); without this lock two pulls read
// the same stale snapshot and both insert the same rows — a primary source of
// local duplicates.
let pullInFlight: Promise<void> | null = null

// Normalize a remote row's identifying fields for the legacy fallback match.
function sameTransaction(local: Transaction, remote: any): boolean {
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

// ---------------------------------------------------------------------------
// PUSH — idempotent upsert keyed on the stable uid (== Supabase row id).
// Pushing the same record twice updates the same row instead of creating a
// duplicate, keeping Supabase clean even if a push is retried.
// ---------------------------------------------------------------------------
export async function pushToPartner(transactions: Transaction[]) {
  if (!supabase || transactions.length === 0) return

  const deviceId = getDeviceId()
  const toPush = transactions.filter((t) => Boolean(t.id) && !t.synced && t.accountId)
  log(`push: ${toPush.length} of ${transactions.length} eligible (unsynced + has account)`)

  for (const t of toPush) {
    // Guarantee a stable uid before pushing so local + remote share identity.
    const uid = t.uid ?? genUuid()
    if (!t.uid) {
      await db.transactions.update(t.id as number, { uid })
    }

    const { error } = await supabase
      .from("shared_transactions")
      .upsert(
        {
          id: uid, // shared_transactions.id is a uuid — supplying it makes upsert idempotent
          date: t.date.toISOString(),
          amount: t.amount,
          merchant: t.merchant || null,
          category: t.category,
          type: t.type,
          note: t.note || null,
          account_id: t.accountId,
          device_id: deviceId,
        },
        { onConflict: "id" },
      )

    if (!error) {
      await db.transactions.update(t.id as number, {
        synced: true,
        lastSynced: new Date().toISOString(),
      })
      localStorage.setItem("lastPushed", new Date().toISOString())
      log(`push ok uid=${uid.slice(0, 8)} amount=${t.amount} ${t.category}`)
    } else {
      console.error("[v0][sync] push failed for transaction:", error, t)
    }
  }
}

// ---------------------------------------------------------------------------
// PULL — idempotent. Records are matched by uid (exact shared identity). Legacy
// local rows created before uid existed are healed by a one-time fuzzy match
// that adopts the remote uid. Genuinely new rows are inserted exactly once.
// `full` ignores the incremental cursor and re-scans everything.
// ---------------------------------------------------------------------------
export async function pullFromPartner(opts: { full?: boolean } = {}): Promise<void> {
  if (!supabase) return

  // Coalesce concurrent callers onto the single in-flight pull.
  if (pullInFlight) {
    log("pull: already in flight, awaiting existing run")
    return pullInFlight
  }

  pullInFlight = (async () => {
    const cursor = opts.full ? null : localStorage.getItem("syncCursor")
    log(`pull started${opts.full ? " (full)" : cursor ? ` (since ${cursor})` : " (initial)"}`)

    let query = supabase!
      .from("shared_transactions")
      .select("*")
      .order("created_at", { ascending: true })

    // Incremental: only fetch rows created after the last cursor. Pull is still
    // idempotent (uid-keyed), so any overlap is harmless.
    if (cursor) query = query.gt("created_at", cursor)

    const { data, error } = await query

    if (error || !data) {
      console.error("[v0][sync] pull error:", error)
      return
    }

    log(`pull fetched ${data.length} remote row(s)`)
    if (data.length === 0) {
      localStorage.setItem("lastPulled", new Date().toISOString())
      return
    }

    let inserted = 0
    let updated = 0
    let healed = 0
    const claimedLocalIds = new Set<number>()
    let maxCreatedAt = cursor || ""

    await db.transaction("rw", db.transactions, async () => {
      const existing = await db.transactions.toArray()
      const byUid = new Map<string, Transaction>()
      for (const local of existing) {
        if (local.uid) byUid.set(local.uid, local)
      }

      for (const remote of data) {
        if (remote.created_at && remote.created_at > maxCreatedAt) {
          maxCreatedAt = remote.created_at
        }

        const remoteUid: string = remote.id
        const nowIso = new Date().toISOString()

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

        // 1. Exact identity match by uid → update in place (idempotent).
        const uidMatch = byUid.get(remoteUid)
        if (uidMatch) {
          await db.transactions.update(uidMatch.id!, { ...mapped, id: uidMatch.id })
          updated++
          continue
        }

        // 2. Legacy heal: adopt remote uid onto a pre-uid local row that looks
        //    like the same transaction, so we don't create a duplicate.
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

        // 3. Genuinely new remote row → insert once.
        const newId = (await db.transactions.add(mapped)) as number
        byUid.set(remoteUid, { ...mapped, id: newId })
        inserted++
      }
    })

    if (maxCreatedAt) localStorage.setItem("syncCursor", maxCreatedAt)
    localStorage.setItem("lastPulled", new Date().toISOString())
    log(`pull done: inserted=${inserted} updated=${updated} healed=${healed}`)
  })()

  try {
    await pullInFlight
  } finally {
    pullInFlight = null
  }
}

// ---------------------------------------------------------------------------
// FULL RESYNC — wipe local synced data + reset cursor, then pull everything
// fresh. Every remote row is inserted exactly once with its uuid, guaranteeing
// a duplicate-free local DB.
// ---------------------------------------------------------------------------
export async function clearLocalDataAndResync(): Promise<void> {
  log("full resync: clearing local synced data")
  await clearSyncedLocalData()
  await pullFromPartner({ full: true })
  log("full resync: complete")
}

export type SyncStatus = {
  lastPushed: string | null
  lastPulled: string | null
  pendingCount: number
}

export function getSyncStatus(): SyncStatus {
  return {
    lastPushed: localStorage.getItem("lastPushed"),
    lastPulled: localStorage.getItem("lastPulled"),
    pendingCount: 0,
  }
}

export async function autoPullIfNeeded() {
  await pullFromPartner()
}
