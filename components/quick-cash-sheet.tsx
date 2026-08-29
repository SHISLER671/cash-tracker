"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeftRight, Camera, Edit3 } from "lucide-react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/db"
import { scheduleSync } from "@/lib/supabase/sync"
import {
  cashBalances,
  getWho,
  logAtm,
  moveBetweenWallets,
  otherWho,
  setWho,
  walletFor,
  whoLabel,
  type Who,
} from "@/lib/household"
import { cn } from "@/lib/utils"

const NUMBER_PAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const

const CHIPS = [
  { id: "food", emoji: "🍔", label: "Food", category: "food" },
  { id: "gas", emoji: "⛽", label: "Gas", category: "gas" },
  { id: "kid", emoji: "👶", label: "Kid", category: "other" },
  { id: "other", emoji: "📦", label: "Other", category: "other" },
] as const

type ChipId = (typeof CHIPS)[number]["id"]
type SheetMode = "spend" | "got" | "move" | "atm"
type AtmDir = "from" | "to"

interface QuickCashSheetProps {
  open: boolean
  onClose: () => void
}

function money(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function QuickCashSheet({ open, onClose }: QuickCashSheetProps) {
  const [who, setWhoState] = useState<Who>("ryan")
  const [mode, setMode] = useState<SheetMode>("spend")
  const [atmDir, setAtmDir] = useState<AtmDir>("from")
  const [fromWho, setFromWho] = useState<Who>("ryan")
  const [amount, setAmount] = useState("")
  const [chipId, setChipId] = useState<ChipId | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const wallets = useLiveQuery(() => (open ? cashBalances() : Promise.resolve(null)), [open])

  useEffect(() => {
    if (!open) return
    const current = getWho()
    setWhoState(current)
    setMode("spend")
    setAtmDir("from")
    setFromWho(otherWho(current))
    setAmount("")
    setChipId(null)
    setIsSaving(false)
  }, [open])

  const toWho = otherWho(fromWho)

  const handleNumberPad = useCallback((key: string) => {
    if (key === "del") {
      setAmount((prev) => prev.slice(0, -1))
      return
    }
    if (key === ".") {
      setAmount((prev) => (prev.includes(".") ? prev : prev + "."))
      return
    }
    setAmount((prev) => {
      const parts = prev.split(".")
      if (parts[1]?.length >= 2) return prev
      return prev + key
    })
  }, [])

  const parsedAmount = parseFloat(amount) || 0
  const chip = CHIPS.find((c) => c.id === chipId)
  const needsChip = mode === "spend" || mode === "got"
  const canSave = parsedAmount > 0 && (!needsChip || Boolean(chip)) && !isSaving

  const handleSave = async () => {
    if (parsedAmount <= 0 || isSaving) return
    if (needsChip && !chip) return
    setIsSaving(true)
    try {
      if (mode === "move") {
        await moveBetweenWallets(fromWho, toWho, parsedAmount)
      } else if (mode === "atm") {
        await logAtm(who, atmDir, parsedAmount)
        setWho(who)
      } else {
        const wallet = await walletFor(who)
        if (!wallet?.id || !chip) {
          setIsSaving(false)
          return
        }
        await db.transactions.add({
          date: new Date(),
          category: chip.category,
          type: mode === "got" ? "in" : "out",
          amount: parsedAmount,
          merchant: whoLabel(who),
          accountId: wallet.id,
          accountType: "cash",
          synced: false,
        })
        setWho(who)
      }
      scheduleSync("quick-cash")
      if (navigator.vibrate) navigator.vibrate(50)
      onClose()
    } catch (error) {
      console.error("Failed to save quick cash:", error)
      setIsSaving(false)
    }
  }

  const saveLabel = (() => {
    if (isSaving) return "Saving…"
    if (mode === "move") return `Give ${whoLabel(toWho)}`
    if (mode === "atm") return atmDir === "from" ? "From ATM" : "Into ATM"
    return "Save"
  })()

  const amountColor =
    mode === "got" || (mode === "atm" && atmDir === "from") || mode === "move"
      ? "text-income"
      : "text-expense"

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick cash"
        className="w-full max-w-md mx-auto bg-popover rounded-t-3xl shadow-luxe overflow-y-auto max-h-[92vh]"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-12 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="px-5 pb-5">
          {mode !== "move" ? (
            <div className="flex rounded-xl bg-card p-1 shadow-earth">
              {(["pia", "ryan"] as const).map((person) => (
                <button
                  key={person}
                  type="button"
                  onClick={() => {
                    setWhoState(person)
                    setFromWho(otherWho(person))
                  }}
                  className={cn(
                    "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all",
                    who === person
                      ? "bg-gradient-to-br from-gold-light to-gold-dark text-primary-foreground shadow-earth"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {whoLabel(person)}
                </button>
              ))}
            </div>
          ) : null}

          <div className={cn("grid grid-cols-2 gap-2", mode !== "move" && "mt-3")}>
            {(
              [
                ["spend", "Spent"],
                ["got", "Got cash"],
                ["move", "Move"],
                ["atm", "ATM"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id)
                  if (id === "move") setFromWho("ryan")
                }}
                className={cn(
                  "rounded-xl py-2.5 text-sm font-semibold shadow-earth transition-all",
                  mode === id
                    ? id === "spend"
                      ? "bg-expense text-white"
                      : id === "got"
                        ? "bg-income text-white"
                        : "bg-gradient-to-br from-gold-light to-gold-dark text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "move" ? (
            <div className="mt-4 flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => setFromWho("pia")}
                className={cn(
                  "flex-1 rounded-2xl border p-3 text-left transition-all",
                  fromWho === "pia"
                    ? "border-gold-light/40 bg-gradient-to-br from-gold-light to-gold-dark text-primary-foreground"
                    : "border-border-luxe bg-card",
                )}
              >
                <p className="text-xs font-medium opacity-80">{fromWho === "pia" ? "From Pia" : "To Pia"}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">${money(wallets?.pia ?? 0)}</p>
              </button>
              <button
                type="button"
                aria-label="Reverse wallets"
                onClick={() => setFromWho(otherWho(fromWho))}
                className="flex flex-col items-center justify-center rounded-2xl bg-card px-2 text-gold-dark shadow-earth active:scale-95"
              >
                <ArrowLeftRight className="h-5 w-5" />
                <span className="mt-1 text-[10px] font-semibold">
                  {whoLabel(fromWho)} → {whoLabel(toWho)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFromWho("ryan")}
                className={cn(
                  "flex-1 rounded-2xl border p-3 text-right transition-all",
                  fromWho === "ryan"
                    ? "border-gold-light/40 bg-gradient-to-br from-gold-light to-gold-dark text-primary-foreground"
                    : "border-border-luxe bg-card",
                )}
              >
                <p className="text-xs font-medium opacity-80">{fromWho === "ryan" ? "From Ryan" : "To Ryan"}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">${money(wallets?.ryan ?? 0)}</p>
              </button>
            </div>
          ) : null}

          {mode === "atm" ? (
            <div className="mt-3 flex rounded-xl bg-card p-1 shadow-earth">
              <button
                type="button"
                onClick={() => setAtmDir("from")}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all",
                  atmDir === "from" ? "bg-income text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                From ATM
              </button>
              <button
                type="button"
                onClick={() => setAtmDir("to")}
                className={cn(
                  "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all",
                  atmDir === "to" ? "bg-expense text-white" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Into ATM
              </button>
            </div>
          ) : null}

          <div className="flex flex-col items-center py-5">
            <div className={cn("flex items-baseline gap-1", amountColor)}>
              <span className="text-3xl font-bold">$</span>
              <span className="text-6xl font-bold tabular-nums">{amount || "0"}</span>
            </div>
            {mode === "move" ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {whoLabel(fromWho)} → {whoLabel(toWho)}
              </p>
            ) : null}
            {mode === "atm" ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {atmDir === "from" ? "Cash into" : "Cash out of"} {whoLabel(who)}’s wallet
              </p>
            ) : null}
          </div>

          {needsChip ? (
            <div className="grid grid-cols-4 gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChipId(c.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl border px-1 py-3 text-sm font-semibold transition-all active:scale-95",
                    chipId === c.id
                      ? "border-gold-light/40 bg-gradient-to-br from-gold-light to-gold-dark text-primary-foreground shadow-earth"
                      : "border-border-luxe bg-card text-foreground hover:bg-secondary",
                  )}
                >
                  <span className="text-xl">{c.emoji}</span>
                  {c.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className={cn("grid grid-cols-3 gap-2", needsChip && "mt-4")}>
            {NUMBER_PAD.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleNumberPad(key)}
                className="flex h-14 items-center justify-center rounded-xl bg-card text-xl font-semibold text-foreground shadow-earth transition-all hover:bg-secondary active:scale-95"
              >
                {key === "del" ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
                    />
                  </svg>
                ) : (
                  key
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="mt-4 w-full rounded-xl bg-gradient-to-br from-gold-light to-gold-dark py-4 text-lg font-bold text-primary-foreground shadow-luxe transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveLabel}
          </button>

          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Photo or full form
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/capture"
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-2xl bg-card border border-border-luxe py-3 text-sm font-semibold text-foreground hover:bg-secondary active:scale-[0.985]"
              >
                <Camera className="h-4 w-4 text-gold-dark" />
                Photo
              </Link>
              <Link
                href="/transaction"
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-2xl bg-card border border-border-luxe py-3 text-sm font-semibold text-foreground hover:bg-secondary active:scale-[0.985]"
              >
                <Edit3 className="h-4 w-4 text-gold-dark" />
                Full form
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
