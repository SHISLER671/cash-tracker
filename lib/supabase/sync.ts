import { db, type Transaction } from '@/lib/db'
import { supabase } from './client'

export interface SyncStatus {
  lastPushed: Date | null
  lastPulled: Date | null
  pendingCount: number
}

export function getSyncStatus(): SyncStatus {
  if (typeof window === 'undefined') return { lastPushed: null, lastPulled: null, pendingCount: 0 }
  
  const stored = localStorage.getItem('cashtracker_sync_status')
  if (!stored) return { lastPushed: null, lastPulled: null, pendingCount: 0 }
  
  const parsed = JSON.parse(stored)
  return {
    lastPushed: parsed.lastPushed ? new Date(parsed.lastPushed) : null,
    lastPulled: parsed.lastPulled ? new Date(parsed.lastPulled) : null,
    pendingCount: parsed.pendingCount ?? 0,
  }
}

function saveSyncStatus(status: Partial<SyncStatus>) {
  if (typeof window === 'undefined') return
  const current = getSyncStatus()
  const updated = { ...current, ...status }
  localStorage.setItem('cashtracker_sync_status', JSON.stringify(updated))
}

/** Push new local transactions to Supabase (wife taps "SHARE WITH PARTNER") */
export async function pushToPartner(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const transactions = await db.transactions.toArray()
    const lastPushed = getSyncStatus().lastPushed

    const newTransactions = lastPushed
      ? transactions.filter(t => new Date(t.date) > lastPushed)
      : transactions

    if (newTransactions.length === 0) {
      saveSyncStatus({ lastPushed: new Date(), pendingCount: 0 })
      return { success: true, count: 0 }
    }

    const { error } = await supabase
      .from('shared_transactions')
      .insert(
        newTransactions.map(t => ({
          date: t.date.toISOString(),
          amount: t.amount,
          category: t.category,
          type: t.type,
          note: t.note || null,
          device_id: `web-${Date.now()}`
        }))
      )

    if (error) throw error

    saveSyncStatus({ lastPushed: new Date(), pendingCount: 0 })
    console.log(`✅ Pushed ${newTransactions.length} transactions to Supabase`)

    return { success: true, count: newTransactions.length }
  } catch (error) {
    console.error('Push failed:', error)
    return { success: false, count: 0, error: error instanceof Error ? error.message : 'Push failed' }
  }
}

/** Pull from Supabase (you tap "CHECK FOR UPDATES") */
export async function pullFromPartner(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const lastPulled = getSyncStatus().lastPulled || new Date(0)

    const { data, error } = await supabase
      .from('shared_transactions')
      .select('*')
      .gt('date', lastPulled.toISOString())
      .order('date', { ascending: true })

    if (error) throw error
    if (!data || data.length === 0) {
      saveSyncStatus({ lastPulled: new Date() })
      return { success: true, count: 0 }
    }

    let added = 0
    for (const remote of data) {
      // Avoid duplicates (same date + amount + category)
      const existing = await db.transactions
        .where('date')
        .equals(new Date(remote.date))
        .and(t => t.amount === Number(remote.amount) && t.category === remote.category)
        .first()

      if (!existing) {
        await db.transactions.add({
          date: new Date(remote.date),
          amount: Number(remote.amount),
          category: remote.category as any,
          type: remote.type as any,
          note: remote.note || undefined,
        })
        added++
      }
    }

    saveSyncStatus({ lastPulled: new Date() })
    console.log(`✅ Pulled and added ${added} new transactions`)

    return { success: true, count: added }
  } catch (error) {
    console.error('Pull failed:', error)
    return { success: false, count: 0, error: error instanceof Error ? error.message : 'Pull failed' }
  }
}

export async function getPendingPushCount(): Promise<number> {
  const transactions = await db.transactions.toArray()
  const lastPushed = getSyncStatus().lastPushed
  if (!lastPushed) return transactions.length
  return transactions.filter(t => new Date(t.date) > lastPushed).length
}
