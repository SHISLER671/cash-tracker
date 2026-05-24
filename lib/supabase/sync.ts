import { supabase } from "./client"
import { db, type Transaction } from "@/lib/db"
import { toast } from "sonner"

export type SyncStatus = {
  lastPushed: string | null
  lastPulled: string | null
  pendingCount: number
}

export async function pushToPartner(transactions: Transaction[]) {
  if (!supabase) return

  // Only process transactions that actually have an ID (safety guard)
  const toPush = transactions.filter(t => Boolean(t.id) && !t.synced)

  if (toPush.length === 0) {
    console.log("No valid unsynced transactions to push")
    return
  }

  for (const t of toPush) {
    const { error } = await supabase.from("shared_transactions").insert({
      date: t.date.toISOString(),
      amount: t.amount,
      merchant: t.merchant || null,
      category: t.category,
      type: t.type,
      note: t.note || null,
      device_id: `web-${Date.now()}`,
    })

    if (!error) {
      // Safe update — we already filtered for valid id
      await db.transactions.update(t.id as number, { synced: true })
    } else {
      console.error("Failed to push one transaction:", error, t)
    }
  }
}

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
    // STRICTER deduplication: exact date (day), exact amount, category
    const remoteDateStr = new Date(remote.date).toISOString().split('T')[0] // YYYY-MM-DD only

    const isDuplicate = existing.some(local => {
      const localDateStr = local.date.toISOString().split('T')[0]
      return (
        localDateStr === remoteDateStr &&
        local.amount === remote.amount &&
        local.category.toLowerCase() === (remote.category || "").toLowerCase() &&
        local.type === remote.type
      )
    })

    if (!isDuplicate) {
      newTransactions.push({
        id: undefined,                    // Dexie will auto-assign
        date: new Date(remote.date),
        amount: remote.amount,
        merchant: remote.merchant || "",
        category: remote.category || "other",
        type: remote.type,
        note: remote.note || undefined,
        synced: true,
      })
    }
  }

  if (newTransactions.length > 0) {
    console.log(`✅ Adding ${newTransactions.length} new transactions from partner`)
    await db.transactions.bulkAdd(newTransactions)
  } else {
    console.log("✅ No new transactions to pull")
  }

  // Update last pulled timestamp
  localStorage.setItem("lastPulled", new Date().toISOString())
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
