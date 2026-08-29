"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeft, Lock, Trash2, Upload, Download, Users, RefreshCw } from "lucide-react"
import { db, softDeleteTransactionsWhere, type Account } from "@/lib/db"
import { getWho, setWho, getPin, setPin, isWalletMove, type Who } from "@/lib/household"
import { format, formatDistanceToNow } from "date-fns"
import { getSyncStatus, getPendingPushCount, syncNow, pullFromPartner, clearLocalDataAndResync, scheduleSync, type SyncStatus } from "@/lib/supabase/sync"

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
  const [isResyncing, setIsResyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [who, setWhoState] = useState<Who>("ryan")
  const [pinValue, setPinValue] = useState("")

  const loadSyncStatus = async () => {
    const status = getSyncStatus()
    const pending = await getPendingPushCount()
    setSyncStatus({ ...status, pendingCount: pending })
  }

  useEffect(() => {
    void loadSyncStatus()
    setWhoState(getWho())
    setPinValue(getPin())
  }, [])

  // Accounts + Wallet Balances
  const accounts = useLiveQuery(() => db.accounts.toArray(), [])
  const walletBalances = useLiveQuery(async () => {
    const allTx = await db.transactions.toArray()
    const balances: Record<string, number> = {}

    accounts?.forEach((acc) => {
      const balance = allTx
        .filter((t) => t.accountId === acc.id)
        .reduce((sum, t) => sum + (t.type === "in" ? t.amount : -t.amount), 0)
      balances[acc.name] = balance
    })

    const householdTotal = Object.values(balances).reduce((sum, b) => sum + b, 0)

    return { balances, householdTotal }
  }, [accounts])

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

    const monthly = all.filter(t => t.date >= monthStart && t.date < monthEnd && t.type === "out" && !isWalletMove(t.note))

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
    // Soft-delete so these removals also propagate to Supabase/other devices.
    await softDeleteTransactionsWhere((t) => new Date(t.date) < ninetyDaysAgo)
    scheduleSync("clear-old")
  }

  // Full Resync — clears local synced data (transactions + receipts), resets the
  // sync cursor, and pulls everything fresh from Supabase so every record is
  // inserted exactly once. Accounts, budgets and presets are preserved.
  const handleFullResync = async () => {
    if (!confirm("This will clear ALL local transactions and receipts, then pull fresh data from Supabase.\n\nYour accounts, budgets and categories are kept.\n\nContinue?")) return

    setIsResyncing(true)
    setSyncMessage(null)

    try {
      await clearLocalDataAndResync()
      const count = await db.transactions.count()
      setSyncMessage(`Full resync complete — ${count} transaction${count === 1 ? "" : "s"}`)
    } catch (e) {
      console.error("Resync error:", e)
      setSyncMessage("Resync failed - check console")
    } finally {
      setIsResyncing(false)
      await loadSyncStatus()
      setTimeout(() => setSyncMessage(null), 4000)
    }
  }

  const handleSyncNow = async () => {
    setIsPushing(true)
    setSyncMessage(null)
    try {
      const result = await syncNow()
      setSyncMessage(result.ok ? "Sync complete" : `Sync failed: ${result.error}`)
    } catch {
      setSyncMessage("Sync failed - check console")
    } finally {
      setIsPushing(false)
      await loadSyncStatus()
      setTimeout(() => setSyncMessage(null), 4000)
    }
  }

  // Improved Push - safe version
  const handlePushToPartner = async () => {
    setIsPushing(true)
    setSyncMessage(null)

    try {
      // SAFE query: fetch all + filter in memory (avoids index/key errors)
      const allTx = await db.transactions.toArray()
      const unsynced = allTx.filter(t => t.synced === false && Boolean(t.id))

      // Full reconcile: force-upserts every local row (heals rows wrongly
      // marked synced that never reached the server) + pending deletions, then
      // does a full pull so this device ends up fully consistent with Supabase.
      await syncNow({ force: true, full: true })
      setSyncMessage(
        unsynced.length > 0
          ? `Shared ${unsynced.length} transaction${unsynced.length > 1 ? "s" : ""}`
          : "Everything is up to date",
      )
    } catch (e) {
      console.error("Push error:", e)
      setSyncMessage("Push failed - check console")
    } finally {
      setIsPushing(false)
      await loadSyncStatus()
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
      await loadSyncStatus()
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

        <section className="mt-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">This phone is</h2>
          <div className="space-y-3 rounded-xl bg-card p-4 shadow-earth">
            <div className="flex rounded-xl bg-secondary p-1">
              {(["pia", "ryan"] as const).map((person) => (
                <button
                  key={person}
                  type="button"
                  onClick={() => {
                    setWho(person)
                    setWhoState(person)
                  }}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                    who === person
                      ? "bg-gradient-to-br from-gold-light to-gold-dark text-primary-foreground shadow-earth"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {person === "pia" ? "Pia" : "Ryan"}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="household-pin" className="mb-2 block text-sm font-medium text-foreground">
                Optional 4-digit PIN
              </label>
              <input
                id="household-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pinValue}
                placeholder="Blank = off"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 4)
                  setPinValue(digits)
                  if (digits.length === 0 || digits.length === 4) {
                    setPin(digits)
                  }
                }}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="mt-2 text-xs text-muted-foreground">Leave blank to keep the app unlocked.</p>
            </div>
          </div>
        </section>

        {/* Wallet Balances */}
        <section className="mt-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet Balances</h2>
          <div className="space-y-3 rounded-xl bg-card p-4 shadow-earth">
            {accounts?.map((acc) => (
              <div key={acc.id} className="flex justify-between items-center">
                <span className="font-medium">{acc.name}</span>
                <span className="font-bold text-foreground">
                  ${(walletBalances?.balances[acc.name] ?? 0).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t pt-3 flex justify-between font-semibold text-lg">
              <span>Household Total</span>
              <span className="text-emerald-600">
                ${(walletBalances?.householdTotal ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </section>

        {/* Monthly Budgets */}
        <section className="mt-8">
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
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${syncMessage.includes("Shared") || syncMessage.includes("Received") || syncMessage.includes("resync") ? "bg-emerald-100 text-emerald-700" : syncMessage.includes("failed") ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
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

            {/* Sync Now */}
            <button
              onClick={handleSyncNow}
              disabled={isPushing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-card py-4 text-foreground font-semibold shadow-earth hover:bg-secondary active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${isPushing ? "animate-spin" : ""}`} />
              {isPushing ? "SYNCING..." : "SYNC NOW"}
            </button>

            {/* Full Resync */}
            <button
              onClick={handleFullResync}
              disabled={isResyncing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-4 text-white font-semibold shadow-earth hover:brightness-95 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${isResyncing ? "animate-spin" : ""}`} />
              {isResyncing ? "RESYNCING..." : "FULL RESYNC (clear & refresh)"}
            </button>
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
