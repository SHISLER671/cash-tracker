"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeft, Plus, Lock, Trash2, Upload, Download, Users } from "lucide-react"
import Link from "next/link"
import { db } from "@/lib/db"
import { format, formatDistanceToNow } from "date-fns"
import { getSyncStatus, pushToPartner, pullFromPartner, type SyncStatus } from "@/lib/supabase/sync"

const defaultBudgets = {
  gas: 150,
  food: 400,
  medical: 200,
  other: 100,
}

export default function SettingsPage() {
  const router = useRouter()
  const currentMonth = format(new Date(), "yyyy-MM")
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ lastPushed: null, lastPulled: null, pendingCount: 0 })
  const [isPushing, setIsPushing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Load sync status
  useEffect(() => {
    const status = getSyncStatus()
    setSyncStatus(status)
  }, [])

  // Budgets
  const budgets = useLiveQuery(async () => {
    const stored = await db.budgets.where("month").equals(currentMonth).toArray()
    const map: Record<string, number> = { ...defaultBudgets }
    stored.forEach(b => { map[b.category] = b.limit })
    return map
  }, [currentMonth])

  // Spending this month
  const spending = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    const monthStart = new Date(currentMonth + "-01")
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    const monthly = all.filter(t => t.date >= monthStart && t.date < monthEnd && t.type === "out")

    return {
      gas: monthly.filter(t => t.category === "gas").reduce((sum, t) => sum + t.amount, 0),
      food: monthly.filter(t => t.category === "food").reduce((sum, t) => sum + t.amount, 0),
      medical: monthly.filter(t => t.category === "medical").reduce((sum, t) => sum + t.amount, 0),
      other: monthly.filter(t => t.category === "other").reduce((sum, t) => sum + t.amount, 0),
    }
  }, [currentMonth])

  const storageUsed = useLiveQuery(async () => {
    const count = await db.transactions.count()
    return Math.round(count * 2)
  }, [])

  const handleEditBudget = (category: string) => {
    setEditingCategory(category)
    setEditValue(String(budgets?.[category] ?? defaultBudgets[category as keyof typeof defaultBudgets]))
  }

  const handleSaveBudget = async () => {
    if (!editingCategory) return
    const value = parseFloat(editValue) || 0
    await db.budgets.put({ month: currentMonth, category: editingCategory, limit: value })
    setEditingCategory(null)
    setEditValue("")
  }

  const handleClearOldReceipts = async () => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    await db.transactions.where("date").below(ninetyDaysAgo).delete()
  }

  // Improved Push
  const handlePushToPartner = async () => {
    setIsPushing(true)
    setSyncMessage(null)

    try {
      const unsynced = await db.transactions.where("synced").equals(false).toArray()
      if (unsynced.length === 0) {
        setSyncMessage("Nothing new to share")
        setTimeout(() => setSyncMessage(null), 2500)
        return
      }

      await pushToPartner(unsynced)
      setSyncMessage(`Shared ${unsynced.length} transaction${unsynced.length > 1 ? 's' : ''}`)
    } catch (e) {
      console.error("Push error:", e)
      setSyncMessage("Push failed - check console")
    } finally {
      setIsPushing(false)
      setSyncStatus(getSyncStatus())
      setTimeout(() => setSyncMessage(null), 4000)
    }
  }

  // Improved Pull
  const handlePullFromPartner = async () => {
    setIsPulling(true)
    setSyncMessage(null)

    try {
      await pullFromPartner()
      setSyncMessage("Received latest transactions")
    } catch (e) {
      console.error("Pull error:", e)
      setSyncMessage("Pull failed - check console")
    } finally {
      setIsPulling(false)
      setSyncStatus(getSyncStatus())
      setTimeout(() => setSyncMessage(null), 4000)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4">
        <header className="flex items-center justify-between border-b border-border py-4">
          <button onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-earth transition-all hover:bg-secondary active:scale-95 active:bg-primary/20">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">SETTINGS</h1>
          <div className="w-11" />
        </header>

        {/* Monthly Budgets */}
        <section className="mt-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly Budgets</h2>
          <div className="grid grid-cols-2 gap-3">
            {["gas", "food", "medical", "other"].map((category) => (
              <button key={category} onClick={() => handleEditBudget(category)} className="flex flex-col items-center gap-1 rounded-xl bg-card p-4 shadow-earth transition-all hover:shadow-earth-lg active:scale-98">
                <span className="text-xs font-semibold uppercase text-muted-foreground">{category.toUpperCase()}</span>
                <span className="text-2xl font-bold text-foreground">${budgets?.[category] ?? defaultBudgets[category as keyof typeof defaultBudgets]}</span>
                <span className="text-xs text-muted-foreground">spent ${spending?.[category as keyof typeof spending]?.toFixed(0) ?? 0}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Storage */}
        <section className="mt-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Storage</h2>
          <div className="flex items-center justify-between rounded-xl bg-card p-4 shadow-earth">
            <div className="flex items-center gap-3">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Receipts: {storageUsed ?? 0}KB used</p>
                <p className="text-xs text-muted-foreground">Keeps last 90 days</p>
              </div>
            </div>
            <button onClick={handleClearOldReceipts} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-primary">
              CLEAR OLD
            </button>
          </div>
        </section>

        {/* Partner Sync */}
        <section className="mt-8">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-4 w-4" />
            PARTNER SYNC
          </h2>

          {syncMessage && (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${syncMessage.includes("Shared") || syncMessage.includes("Received") ? "bg-emerald-100 text-emerald-700" : syncMessage.includes("failed") ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
              {syncMessage}
            </div>
          )}

          <div className="space-y-3">
            {/* Share */}
            <div className="rounded-xl bg-card p-4 shadow-earth">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Upload className="h-5 w-5 text-income" />
                  <div>
                    <p className="text-sm font-medium">Share with Partner</p>
                    <p className="text-xs text-muted-foreground">
                      {syncStatus.pendingCount > 0 && <span className="text-amber-500">({syncStatus.pendingCount} unsynced) </span>}
                      {syncStatus.lastPushed 
                        ? `Last shared ${formatDistanceToNow(new Date(syncStatus.lastPushed), { addSuffix: true })}`
                        : 'Never shared'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handlePushToPartner}
                  disabled={isPushing}
                  className="flex items-center gap-2 rounded-lg bg-income px-5 py-2 text-sm font-semibold text-white transition-all hover:brightness-95 active:scale-95 disabled:opacity-50"
                >
                  {isPushing ? "SHARING..." : "SHARE"}
                </button>
              </div>
            </div>

            {/* Pull */}
            <div className="rounded-xl bg-card p-4 shadow-earth">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Check for Updates</p>
                    <p className="text-xs text-muted-foreground">
                      {syncStatus.lastPulled 
                        ? `Last checked ${formatDistanceToNow(new Date(syncStatus.lastPulled), { addSuffix: true })}`
                        : 'Never checked'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handlePullFromPartner}
                  disabled={isPulling}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-all hover:brightness-95 active:scale-95 disabled:opacity-50"
                >
                  {isPulling ? "CHECKING..." : "CHECK"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Connect Accounts */}
        <section className="mt-8 mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Lock className="h-4 w-4" />
            Connect Accounts
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-xl bg-card p-4 opacity-50 shadow-earth">
              <div>
                <p className="text-sm font-medium text-foreground">Bank Accounts</p>
                <p className="text-xs text-muted-foreground">via Plaid</p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">COMING SOON</span>
            </div>
          </div>
        </section>
      </main>

      {/* Edit Budget Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-earth-lg">
            <h3 className="mb-4 text-center text-lg font-bold text-foreground">
              Edit {editingCategory.charAt(0).toUpperCase() + editingCategory.slice(1)} Budget
            </h3>
            <div className="mb-6 flex items-center justify-center gap-2">
              <span className="text-3xl font-bold text-foreground">$</span>
              <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-32 border-b-2 border-primary bg-transparent text-center text-4xl font-bold text-foreground outline-none" autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingCategory(null)} className="flex-1 rounded-xl bg-secondary py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted">CANCEL</button>
              <button onClick={handleSaveBudget} className="flex-1 rounded-xl bg-income py-3 text-sm font-semibold text-white transition-colors hover:brightness-95">SAVE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
