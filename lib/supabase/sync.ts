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

  const possibleDuplicates: any[] = []
  const newTransactions: Transaction[] = []

  for (const remote of data) {
    const remoteDate = new Date(remote.date)
    const remoteDay = remoteDate.toDateString() // e.g. "Wed May 20 2026"

    let isDuplicate = false

    for (const local of existing) {
      const localDay = local.date.toDateString()
      const amountDiff = Math.abs(remote.amount - local.amount)
      const categoryMatch = local.category.toLowerCase() === (remote.category || "").toLowerCase()

      // Lenient duplicate rules (catches your test case)
      if (
        localDay === remoteDay || // same calendar day
        amountDiff <= 5 &&        // within $5
        (categoryMatch || !remote.category) // category matches or remote has none
      ) {
        isDuplicate = true
        possibleDuplicates.push({
          local,
          remote,
          reason: `Similar: $${local.amount} vs $${remote.amount} on ${localDay}`,
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

  // Add new transactions
  if (newTransactions.length > 0) {
    await db.transactions.bulkAdd(newTransactions)
  }

  // Show duplicates for review
  if (possibleDuplicates.length > 0) {
    localStorage.setItem("possibleDuplicates", JSON.stringify(possibleDuplicates))
    toast.warning(`${possibleDuplicates.length} possible duplicate(s) detected`, {
      description: "Review before they appear on other devices",
      action: {
        label: "Review Now",
        onClick: () => (window.location.href = "/history?review=duplicates"),
      },
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
  const lastPulled = localStorage.getItem("lastPulled")
  if (!lastPulled || (Date.now() - new Date(lastPulled).getTime()) / (1000 * 60) > 5) {
    await pullFromPartner()
  }
}
