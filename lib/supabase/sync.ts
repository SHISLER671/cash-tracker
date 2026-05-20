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

  if (error || !data) {
    console.log("❌ Supabase pull failed", error)
    return
  }

  const existing = await db.transactions.toArray()
  console.log(`📊 ${existing.length} local | ${data.length} remote transactions`)

  const possibleDuplicates: any[] = []
  const newTransactions: Transaction[] = []

  for (const remote of data) {
    let isDuplicate = false

    for (const local of existing) {
      const daysDiff = Math.abs(new Date(remote.date).getTime() - local.date.getTime()) / (1000 * 3600 * 24)
      const amountDiff = Math.abs(remote.amount - local.amount)

      // Very lenient rules — catches almost all real duplicates
      if (
        daysDiff <= 7 ||                    // within 1 week
        amountDiff <= 15                    // within $15
      ) {
        isDuplicate = true
        possibleDuplicates.push({
          local,
          remote,
          reason: `Close match: $${local.amount} vs $${remote.amount} (${daysDiff.toFixed(1)} days apart)`
        })
        console.log("⚠️ DUPLICATE FLAGGED:", possibleDuplicates[possibleDuplicates.length - 1])
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
    console.log(`✅ Added ${newTransactions.length} new transactions`)
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
