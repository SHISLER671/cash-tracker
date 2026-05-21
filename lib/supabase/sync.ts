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
  const toPush = transactions.filter(t => !t.synced)
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
    if (!error) await db.transactions.update(t.id!, { synced: true })
  }
}

export async function pullFromPartner() {
  if (!supabase) return

  console.log("🔍 pullFromPartner started")

  const { data, error } = await supabase
    .from("shared_transactions")
    .select("*")
    .order("created_at", { ascending: false })

  if (error || !data) return

  const existing = await db.transactions.toArray()

  const possibleDuplicates: any[] = []
  const newTransactions: Transaction[] = []

  for (const remote of data) {
    let isDuplicate = false

    for (const local of existing) {
      const daysDiff = Math.abs(new Date(remote.date).getTime() - local.date.getTime()) / (1000 * 3600 * 24)
      const amountDiff = Math.abs(remote.amount - local.amount)

      // Tight rules — only flag very likely duplicates
      if (
        daysDiff <= 1 &&                     // same day or next day
        amountDiff <= 5 &&                   // within $5
        (local.category.toLowerCase() === (remote.category || "").toLowerCase() || !remote.category)
      ) {
        isDuplicate = true
        possibleDuplicates.push({
          local,
          remote,
          reason: `Close match: $${local.amount} vs $${remote.amount} (${daysDiff.toFixed(1)} days apart)`
        })
        break
      }
    }

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
      })
    }
  }

  if (newTransactions.length > 0) {
    await db.transactions.bulkAdd(newTransactions)
  }

  if (possibleDuplicates.length > 0) {
    localStorage.setItem("possibleDuplicates", JSON.stringify(possibleDuplicates))
    toast.warning(`${possibleDuplicates.length} possible duplicate(s) detected`, {
      description: "Review before they sync everywhere",
      action: { label: "Review Now", onClick: () => (window.location.href = "/history?review=duplicates") },
    })
  }

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
