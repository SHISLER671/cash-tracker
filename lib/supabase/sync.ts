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
      merchant: t.merchant,
      category: t.category,
      type: t.type,
      note: t.note || null,
      device_id: `web-${Date.now()}`,
    })
    if (!error) {
      await db.transactions.update(t.id!, { synced: true })
    }
  }
}

export async function pullFromPartner() {
  if (!supabase) return

  const { data, error } = await supabase
    .from("shared_transactions")
    .select("*")
    .order("created_at", { ascending: false })

  if (error || !data) return

  const existing = await db.transactions.toArray()
  const existingMap = new Map(existing.map(t => [`${t.date.toISOString().split("T")[0]}-${t.amount}-${t.category}`, t]))

  const newTransactions: Transaction[] = []
  const possibleDuplicates: any[] = []

  for (const remote of data) {
    const key = `${new Date(remote.date).toISOString().split("T")[0]}-${remote.amount}-${remote.category}`

    const localMatch = existingMap.get(key)

    if (localMatch) {
      // Rule-based duplicate check
      const daysDiff = Math.abs(new Date(remote.date).getTime() - localMatch.date.getTime()) / (1000 * 3600 * 24)
      const amountDiff = Math.abs(remote.amount - localMatch.amount)

      if (daysDiff < 1 && amountDiff <= 3) {
        possibleDuplicates.push({
          local: localMatch,
          remote: remote,
          reason: "Very similar (same day + amount)",
        })
        continue // skip auto-add
      }
    }

    newTransactions.push({
      id: undefined,
      date: new Date(remote.date),
      amount: remote.amount,
      merchant: remote.merchant || "",
      category: remote.category,
      type: remote.type,
      note: remote.note || undefined,
      synced: true,
    })
  }

  // Insert new transactions
  if (newTransactions.length > 0) {
    await db.transactions.bulkAdd(newTransactions)
  }

  // Store possible duplicates for review
  if (possibleDuplicates.length > 0) {
    localStorage.setItem("possibleDuplicates", JSON.stringify(possibleDuplicates))
    toast.warning(`${possibleDuplicates.length} possible duplicate(s) detected`, {
      description: "Tap to review",
      action: { label: "Review", onClick: () => window.location.href = "/history?review=duplicates" },
    })
  }

  // Update last pulled time
  localStorage.setItem("lastPulled", new Date().toISOString())
}

export function getSyncStatus(): SyncStatus {
  return {
    lastPushed: localStorage.getItem("lastPushed"),
    lastPulled: localStorage.getItem("lastPulled"),
    pendingCount: 0, // we can calculate this later if needed
  }
}

export async function autoPullIfNeeded() {
  const lastPulled = localStorage.getItem("lastPulled")
  if (!lastPulled) {
    await pullFromPartner()
    return
  }

  const minutesSinceLastPull = (Date.now() - new Date(lastPulled).getTime()) / (1000 * 60)
  if (minutesSinceLastPull > 5) {
    await pullFromPartner()
  }
}
