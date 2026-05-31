import { createClient } from '@supabase/supabase-js'
import { db, type Transaction } from '@/lib/db'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Only create the client when both env vars exist. This prevents the entire
// app from crashing at import time if the keys are missing or not yet injected.
export const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

if (!supabase) {
  console.warn("Supabase env vars missing — sync features are disabled.")
}

// Push new transactions to Supabase (with account ownership)
export async function pushToPartner(transactions: Transaction[]) {
  if (!supabase || transactions.length === 0) return

  const toPush = transactions.filter(t => Boolean(t.id) && !t.synced && t.accountId)

  for (const t of toPush) {
    const { error } = await supabase.from("shared_transactions").insert({
      date: t.date.toISOString(),
      amount: t.amount,
      merchant: t.merchant || null,
      category: t.category,
      type: t.type,
      note: t.note || null,
      account_id: t.accountId,
    })

    if (!error) {
      await db.transactions.update(t.id as number, { synced: true })
      localStorage.setItem("lastPushed", new Date().toISOString())
    } else {
      console.error("Push failed for transaction:", error, t)
    }
  }
}

// Pull transactions from Supabase (strong deduplication + account support)
export async function pullFromPartner() {
  if (!supabase) return

  console.log("🔍 pullFromPartner started")

  const { data, error } = await supabase
    .from("shared_transactions")
    .select("*")
    .order("created_at", { ascending: false })

  if (error || !data) {
    console.error("Pull error:", error)
    return
  }

  const existing = await db.transactions.toArray()

  const newTransactions: Transaction[] = []

  for (const remote of data) {
    const remoteDateStr = new Date(remote.date).toISOString().split('T')[0]

    const isDuplicate = existing.some(local => {
      const localDateStr = local.date.toISOString().split('T')[0]
      return (
        localDateStr === remoteDateStr &&
        local.amount === remote.amount &&
        local.category.toLowerCase() === (remote.category || "").toLowerCase() &&
        local.type === remote.type &&
        local.accountId === remote.account_id
      )
    })

    if (!isDuplicate) {
      newTransactions.push({
        id: undefined,
        date: new Date(remote.date),
        amount: remote.amount,
        merchant: remote.merchant || "",
        category: remote.category || "other",
        type: remote.type,
        note: remote.note || undefined,
        synced: true,
        accountId: remote.account_id,
        accountType: "cash",
      })
    }
  }

  if (newTransactions.length > 0) {
    console.log(`✅ Adding ${newTransactions.length} new transactions from partner`)
    await db.transactions.bulkAdd(newTransactions)
  } else {
    console.log("✅ No new transactions to pull")
  }

  localStorage.setItem("lastPulled", new Date().toISOString())
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
