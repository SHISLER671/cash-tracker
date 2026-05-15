"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { X, Check, ArrowLeft } from "lucide-react"
import { db, saveDraft, getDraft, clearDraft } from "@/lib/db"
import { type Category } from "@/components/category-buttons"

const categories: { id: Category; label: string; icon: string }[] = [
  { id: "gas", label: "GAS", icon: "GAS" },
  { id: "food", label: "FOOD", icon: "FOOD" },
  { id: "medical", label: "MED", icon: "MED" },
  { id: "other", label: "OTHER", icon: "OTHER" },
]

const numberPadKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"]

export default function TransactionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [type, setType] = useState<"in" | "out">("out")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<Category | null>(null)
  const [note, setNote] = useState("")
  const [selectedDate, setSelectedDate] = useState<"today" | "yesterday" | "other">("today")
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showUndo, setShowUndo] = useState(false)
  const [lastTransactionId, setLastTransactionId] = useState<number | null>(null)
  const [showDraftDialog, setShowDraftDialog] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<Awaited<ReturnType<typeof getDraft>> | null>(null)

  // Check for quick add amount from URL
  useEffect(() => {
    const quickAmount = searchParams.get("amount")
    if (quickAmount) {
      setAmount(quickAmount)
      setStep(2) // Go directly to category selection
    }
  }, [searchParams])

  // Check for existing draft on mount
  useEffect(() => {
    const checkDraft = async () => {
      const draft = await getDraft()
      if (draft && draft.amount > 0) {
        setPendingDraft(draft)
        setShowDraftDialog(true)
      }
    }
    checkDraft()
  }, [])

  // Auto-save draft when leaving page or backgrounding
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden && (parseFloat(amount) > 0 || step > 1)) {
        await saveDraft({
          step,
          type,
          amount: parseFloat(amount) || 0,
          category: category ?? undefined,
          note: note || undefined,
        })
      }
    }

    const handleBeforeUnload = async () => {
      if (parseFloat(amount) > 0 || step > 1) {
        await saveDraft({
          step,
          type,
          amount: parseFloat(amount) || 0,
          category: category ?? undefined,
          note: note || undefined,
        })
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [step, type, amount, category, note])

  const handleResumeDraft = () => {
    if (pendingDraft) {
      setStep(pendingDraft.step)
      setType(pendingDraft.type)
      setAmount(String(pendingDraft.amount))
      setCategory(pendingDraft.category ?? null)
      setNote(pendingDraft.note ?? "")
    }
    setShowDraftDialog(false)
    clearDraft()
  }

  const handleDiscardDraft = () => {
    setShowDraftDialog(false)
    clearDraft()
  }

  // Calculate remaining balance
  const currentBalance = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    return all.reduce((acc, t) => acc + (t.type === "in" ? t.amount : -t.amount), 0)
  }, [])

  const parsedAmount = parseFloat(amount) || 0
  const afterBalance = type === "in" 
    ? (currentBalance ?? 0) + parsedAmount 
    : (currentBalance ?? 0) - parsedAmount

  const handleNumberPad = useCallback((key: string) => {
    if (key === "del") {
      setAmount((prev) => prev.slice(0, -1))
    } else if (key === ".") {
      if (!amount.includes(".")) {
        setAmount((prev) => prev + ".")
      }
    } else {
      // Limit to 2 decimal places
      const parts = amount.split(".")
      if (parts[1]?.length >= 2) return
      setAmount((prev) => prev + key)
    }
  }, [amount])

  const handleCategorySelect = (cat: Category) => {
    setCategory(cat)
    setStep(3)
  }

  const getTransactionDate = () => {
    const now = new Date()
    if (selectedDate === "yesterday") {
      now.setDate(now.getDate() - 1)
    }
    return now
  }

  const handleSave = async () => {
    if (!category || parsedAmount <= 0) return
    setIsSaving(true)

    try {
      const id = await db.transactions.add({
        date: getTransactionDate(),
        category,
        type,
        amount: parsedAmount,
        note: note || undefined,
      })

      // Clear any saved draft
      await clearDraft()

      setLastTransactionId(id as number)
      
      // Vibrate if available
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }

      // Show success animation
      setShowSuccess(true)
      
      setTimeout(() => {
        setShowSuccess(false)
        setShowUndo(true)
        router.push("/")
        
        // Hide undo after 5 seconds
        setTimeout(() => {
          setShowUndo(false)
        }, 5000)
      }, 1000)
    } catch (error) {
      console.error("Failed to save transaction:", error)
      setIsSaving(false)
    }
  }

  const handleUndo = async () => {
    if (lastTransactionId) {
      await db.transactions.delete(lastTransactionId)
      setShowUndo(false)
    }
  }

  const goBack = async () => {
    if (step === 1) {
      await clearDraft()
      router.push("/")
    } else if (step === 2) {
      setStep(1)
    } else {
      setStep(2)
    }
  }

  const canProceed = step === 1 && parsedAmount > 0

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Draft Dialog */}
      {showDraftDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-earth-lg">
            <h3 className="text-lg font-bold text-foreground text-center mb-2">
              Resume last entry?
            </h3>
            <p className="text-muted-foreground text-center text-sm mb-6">
              You have an unsaved transaction of ${pendingDraft?.amount.toFixed(2)}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDiscardDraft}
                className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-semibold transition-colors hover:bg-muted"
              >
                DISCARD
              </button>
              <button
                onClick={handleResumeDraft}
                className="flex-1 py-3 rounded-xl bg-income text-white font-semibold transition-colors hover:brightness-95"
              >
                RESUME
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={goBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground shadow-earth transition-colors hover:bg-secondary"
          aria-label="Go back"
        >
          {step === 1 ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>
        <h1 className="text-lg font-bold text-foreground">
          {step === 1 ? "Amount" : step === 2 ? "Category" : "Confirm"}
        </h1>
        <div className="w-10" />
      </header>

      {/* Progress Bar */}
      <div className="flex gap-1 px-4 py-2">
        <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        <div className={`h-1 flex-1 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
      </div>

      {/* Step 1: Amount */}
      {step === 1 && (
        <div className="flex-1 flex flex-col">
          {/* Type Toggle */}
          <div className="flex justify-center py-4">
            <div className="flex rounded-xl bg-card p-1 shadow-earth">
              <button
                onClick={() => setType("in")}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                  type === "in"
                    ? "bg-income text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                INCOMING $
              </button>
              <button
                onClick={() => setType("out")}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                  type === "out"
                    ? "bg-expense text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                OUTGOING $
              </button>
            </div>
          </div>

          {/* Amount Display */}
          <div className="flex flex-col items-center py-6">
            <div className={`flex items-baseline gap-1 ${type === "in" ? "text-income" : "text-expense"}`}>
              <span className="text-4xl font-bold">$</span>
              <span className="text-6xl font-bold tabular-nums">
                {amount || "0.00"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              After: ${afterBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} remaining
            </p>
          </div>

          {/* Number Pad */}
          <div className="flex-1 flex flex-col justify-end p-4">
            <div className="grid grid-cols-3 gap-2">
              {numberPadKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => handleNumberPad(key)}
                  className="flex h-16 items-center justify-center rounded-xl bg-card text-xl font-semibold text-foreground shadow-earth transition-all hover:bg-secondary active:scale-95"
                >
                  {key === "del" ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                    </svg>
                  ) : key}
                </button>
              ))}
            </div>
            
            {/* Next Button */}
            <button
              onClick={() => canProceed && setStep(2)}
              disabled={!canProceed}
              className="mt-4 w-full py-4 rounded-xl bg-primary text-primary-foreground text-lg font-bold shadow-earth transition-all hover:brightness-95 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              NEXT
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Category */}
      {step === 2 && (
        <div className="flex-1 flex flex-col p-4">
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-center text-muted-foreground mb-6">
              {type === "in" ? "Money coming in" : "Money going out"}: 
              <span className={`font-bold ml-2 ${type === "in" ? "text-income" : "text-expense"}`}>
                ${parsedAmount.toFixed(2)}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`flex flex-col items-center gap-2 rounded-2xl p-6 transition-all active:scale-95 ${
                    category === cat.id
                      ? "bg-primary text-primary-foreground shadow-earth-lg ring-2 ring-primary"
                      : "bg-card text-foreground shadow-earth hover:bg-secondary"
                  }`}
                >
                  <span className="text-2xl font-bold">{cat.icon}</span>
                  <span className="text-sm font-semibold">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="flex-1 flex flex-col p-4">
          <div className="flex-1 flex flex-col justify-center gap-6">
            <div className="text-center">
              <p className="text-lg text-muted-foreground mb-2">
                {type === "in" ? "Add" : "Save"}
              </p>
              <p className={`text-4xl font-bold ${type === "in" ? "text-income" : "text-expense"}`}>
                ${parsedAmount.toFixed(2)}
              </p>
              <p className="text-lg text-muted-foreground mt-2">
                to {categories.find(c => c.id === category)?.label}?
              </p>
            </div>

            {/* Date Selection */}
            <div className="flex justify-center gap-2">
              {(["today", "yesterday", "other"] as const).map((dateOption) => (
                <button
                  key={dateOption}
                  onClick={() => setSelectedDate(dateOption)}
                  disabled={dateOption === "other"}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    selectedDate === dateOption
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground shadow-earth hover:bg-secondary"
                  } ${dateOption === "other" ? "opacity-50" : ""}`}
                >
                  {dateOption === "today" ? "TODAY" : dateOption === "yesterday" ? "YESTERDAY" : "OTHER"}
                </button>
              ))}
            </div>

            {/* Optional Note */}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Shell, McDonald's (optional)"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 pb-6">
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-4 rounded-xl bg-secondary text-foreground text-lg font-bold shadow-earth transition-all hover:bg-muted active:scale-98"
            >
              GO BACK
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-4 rounded-xl bg-income text-white text-lg font-bold shadow-earth transition-all hover:brightness-95 active:scale-98 disabled:opacity-50"
            >
              {isSaving ? "SAVING..." : "CONFIRM"}
            </button>
          </div>
        </div>
      )}

      {/* Success Animation Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="animate-[scale-in_0.3s_ease-out] flex h-24 w-24 items-center justify-center rounded-full bg-income">
            <Check className="h-12 w-12 text-white" strokeWidth={3} />
          </div>
        </div>
      )}

      {/* Undo Bar */}
      {showUndo && (
        <div className="fixed bottom-0 inset-x-0 p-4 z-40">
          <div className="mx-auto max-w-md">
            <button
              onClick={handleUndo}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-card py-4 text-foreground shadow-earth-lg transition-all hover:bg-secondary"
            >
              <span className="font-semibold">UNDO</span>
              <span className="text-muted-foreground">(5s)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
