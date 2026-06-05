import { createClient } from '@supabase/supabase-js'
import {
  db,
  genUuid,
  getDeviceId,
  clearSyncedLocalData,
  getUnsyncedTombstones,
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

// Incremental pull cursor. Keyed on the server's `updated_at` (bumped by a DB
// trigger on every insert/update), so edits AND deletes are caught — not just
// new rows. New key name (V3) so the first run after this change does a full
// re-scan rather than trusting the old created_at-based cursor.
const CURSOR_KEY = "syncCursorV3"

// ---------------------------------------------------------------------------
// Logging helper — every sync log is tagged with the device id + timestamp so
// multi-device duplicate/divergence issues are easy to trace across phones.
// ---------------------------------------------------------------------------
function log(...args: unknown[]) {
  const device = getDeviceId().slice(0, 8)
  console.log(`[v0][sync ${device} @ ${new Date().toISOString()}]`, ...args)
}

// Guards against concurrent syncs. autoSync fires on multiple page mounts (and
// twice under React strict mode); without this lock two runs read the same
// stale snapshot and both insert the same rows — a primary source of local
// duplicates.
let syncInFlight: Promise<void> | null = null

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
// PUSH inserts/updates — idempotent upsert keyed on the stable uid (== Supabase
// row id). Pushing the same record twice updates the same row instead of
// creating a duplicate. Every unsynced local row is pushed (NOT just ones with
// an accountId — that old filter silently dropped capture/receipt rows and was
// a primary reason Supabase ended up with fewer rows than the device).
// ---------------------------------------------------------------------------
export async function pushToPartner(opts: { force?: boolean } = {}) {
  if (!supabase) return

  const deviceId = getDeviceId()
  const source = await db.transactions.toArray()
  // Normal sync pushes only unsynced rows (efficient). `force` re-upserts every
  // local row regardless of the synced flag — used by the manual "Share" button
  // to reconcile rows that were wrongly marked synced and never reached the
  // server (the cause of "my phone has more rows than Supabase"). Idempotent.
  const toPush = source.filter((t) => Boolean(t.id) && (opts.force || !t.synced))
  log(`push: ${toPush.length} row(s)${opts.force ? " (force)" : " unsynced"}`)

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
          account_id: t.accountId ?? null,
          device_id: deviceId,
          deleted: false,
          // updated_at is maintained server-side by a trigger.
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
// PUSH deletions — propagate local soft-deletes to Supabase by flipping the
// `deleted` tombstone flag on the remote row. Marking remote (rather than hard
// DELETE) means OTHER devices learn about the deletion on their next pull.
// ---------------------------------------------------------------------------
export async function pushDeletions() {
  if (!supabase) return

  const tombstones = await getUnsyncedTombstones()
  if (tombstones.length === 0) return
  log(`push deletions: ${tombstones.length} tombstone(s)`)

  for (const ts of tombstones) {
    const { error } = await supabase
      .from("shared_transactions")
      .update({ deleted: true })
      .eq("id", ts.uid)

    if (!error) {
      await db.tombstones.update(ts.uid, { synced: true })
      log(`deletion synced uid=${ts.uid.slice(0, 8)}`)
    } else {
      console.error("[v0][sync] deletion push failed:", error, ts)
    }
  }
}

// ---------------------------------------------------------------------------
// PULL — incremental + idempotent. Fetches rows whose updated_at is newer than
// the cursor. Records are matched by uid (exact shared identity); legacy local
// rows created before uid existed are healed by a one-time fuzzy match that
// adopts the remote uid. Remote rows flagged deleted remove the local copy.
// Rows we have a local tombstone for are never re-inserted. `full` ignores the
// cursor and re-scans everything.
// ---------------------------------------------------------------------------
export async function pullFromPartner(opts: { full?: boolean } = {}): Promise<void> {
  if (!supabase) return

  const cursor = opts.full ? null : localStorage.getItem(CURSOR_KEY)
  log(`pull started${opts.full ? " (full)" : cursor ? ` (since ${cursor})` : " (initial)"}`)

  let query = supabase
    .from("shared_transactions")
    .select("*")
    .order("updated_at", { ascending: true })

  // Incremental: only fetch rows changed after the last cursor. Pull is still
  // idempotent (uid-keyed), so any overlap is harmless.
  if (cursor) query = query.gt("updated_at", cursor)

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

    for (const remote of data) {
      if (remote.updated_at && remote.updated_at > maxUpdatedAt) {
        maxUpdatedAt = remote.updated_at
      }

      const remoteUid: string = remote.id
      const nowIso = new Date().toISOString()

      // --- Remote deletion: remove the local copy and record a synced tombstone
      //     so it can never resurrect from an earlier-pulled snapshot. ---
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

      // --- We deleted this locally (deletion pending or already pushed): do not
      //     resurrect it. pushDeletions() will flip the remote flag. ---
      if (tombstoneUids.has(remoteUid)) {
        continue
      }

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

      // 1. Exact identity match by uid → update in place (idempotent). This is
      //    also how EDITS made on another device land here.
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

  if (maxUpdatedAt) localStorage.setItem(CURSOR_KEY, maxUpdatedAt)
  localStorage.setItem("lastPulled", new Date().toISOString())
  log(`pull done: inserted=${inserted} updated=${updated} healed=${healed} removed=${removed}`)
}

// ---------------------------------------------------------------------------
// SYNC NOW — the single entry point for a full bidirectional sync. Order
// matters: push local inserts/edits and deletions FIRST so the server reflects
// our state, then pull to apply everyone else's changes. Guarded by a lock so
// concurrent callers coalesce onto one run.
// ---------------------------------------------------------------------------
export async function syncNow(opts: { full?: boolean; force?: boolean } = {}): Promise<void> {
  if (!supabase) return

  if (syncInFlight) {
    log("syncNow: already in flight, awaiting existing run")
    return syncInFlight
  }

  syncInFlight = (async () => {
    try {
      await pushToPartner({ force: opts.force })
      await pushDeletions()
      await pullFromPartner({ full: opts.full })
    } catch (e) {
      console.error("[v0][sync] syncNow error:", e)
    }
  })()

  try {
    await syncInFlight
  } finally {
    syncInFlight = null
  }
}

// ---------------------------------------------------------------------------
// FULL RESYNC — wipe local synced data + tombstones + cursor, then pull
// everything fresh. Every remote (non-deleted) row is inserted exactly once
// with its uuid, guaranteeing a duplicate-free local DB that matches Supabase.
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

// Called on app/page mounts. Now does a full bidirectional sync (push + pull)
// rather than a pull-only, so locally-created rows reliably reach Supabase even
// if the user never visits Settings.
export async function autoPullIfNeeded() {
  await syncNow()
}
