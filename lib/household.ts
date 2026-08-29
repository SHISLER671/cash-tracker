import { db, type Account } from "@/lib/db"

export type Who = "pia" | "ryan"

export const WHO_KEY = "cashtracka_who"
export const PIN_KEY = "cashtracka_pin"

const HIS_WALLET = { name: "His Wallet", owner: "PartnerHusband", type: "cash" as const }
const HER_WALLET = { name: "Her Wallet", owner: "PartnerWife", type: "cash" as const }

export function whoLabel(who: Who): "Pia" | "Ryan" {
  return who === "pia" ? "Pia" : "Ryan"
}

function parseWho(value: string | null): Who | null {
  if (value === "pia" || value === "ryan") return value
  return null
}

export function getWho(): Who {
  if (typeof window === "undefined") return "ryan"
  try {
    return parseWho(localStorage.getItem(WHO_KEY)) ?? "ryan"
  } catch {
    return "ryan"
  }
}

export function setWho(who: Who): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(WHO_KEY, who)
  } catch {
    // ignore quota / private-mode errors
  }
}

export function getPin(): string {
  if (typeof window === "undefined") return ""
  try {
    return localStorage.getItem(PIN_KEY) ?? ""
  } catch {
    return ""
  }
}

export function setPin(pin: string): void {
  if (typeof window === "undefined") return
  try {
    const digits = pin.replace(/\D/g, "").slice(0, 4)
    if (digits.length === 0) {
      localStorage.removeItem(PIN_KEY)
    } else {
      localStorage.setItem(PIN_KEY, digits)
    }
  } catch {
    // ignore quota / private-mode errors
  }
}

/** Seed His/Her Wallet only on a brand-new accounts table. */
export async function seedHouseholdWallets(): Promise<void> {
  const count = await db.accounts.count()
  if (count !== 0) return
  await db.accounts.bulkAdd([
    { name: HIS_WALLET.name, owner: HIS_WALLET.owner, type: HIS_WALLET.type },
    { name: HER_WALLET.name, owner: HER_WALLET.owner, type: HER_WALLET.type },
  ])
}

export async function walletFor(who: Who): Promise<Account | undefined> {
  await seedHouseholdWallets()
  const accounts = await db.accounts.toArray()
  const wanted = who === "pia" ? HER_WALLET : HIS_WALLET
  return (
    accounts.find((a: Account) => a.owner === wanted.owner) ??
    accounts.find((a: Account) => a.name === wanted.name)
  )
}

export function otherWho(who: Who): Who {
  return who === "pia" ? "ryan" : "pia"
}

export const MOVE_NOTE = "Wallet move"
export const ATM_IN_NOTE = "ATM withdrawal"
export const ATM_OUT_NOTE = "ATM deposit"

export function isWalletMove(note?: string): boolean {
  return (note || "").trim() === MOVE_NOTE
}

export async function cashBalances(): Promise<{ pia: number; ryan: number }> {
  const [piaWallet, ryanWallet, txs] = await Promise.all([
    walletFor("pia"),
    walletFor("ryan"),
    db.transactions.toArray(),
  ])
  const sumFor = (accountId: number | undefined) => {
    if (!accountId) return 0
    return txs
      .filter((t: { accountId?: number; type: string; amount: number }) => t.accountId === accountId)
      .reduce(
        (sum: number, t: { type: string; amount: number }) =>
          sum + (t.type === "in" ? t.amount : -t.amount),
        0,
      )
  }
  return { pia: sumFor(piaWallet?.id), ryan: sumFor(ryanWallet?.id) }
}

export async function moveBetweenWallets(from: Who, to: Who, amount: number): Promise<void> {
  if (from === to || amount <= 0) return
  const [fromWallet, toWallet] = await Promise.all([walletFor(from), walletFor(to)])
  if (!fromWallet?.id || !toWallet?.id) return
  const now = new Date()
  await db.transaction("rw", db.transactions, async () => {
    await db.transactions.add({
      date: now,
      category: "other",
      type: "out",
      amount,
      merchant: whoLabel(from),
      note: MOVE_NOTE,
      accountId: fromWallet.id,
      accountType: "cash",
      synced: false,
    })
    await db.transactions.add({
      date: now,
      category: "other",
      type: "in",
      amount,
      merchant: whoLabel(to),
      note: MOVE_NOTE,
      accountId: toWallet.id,
      accountType: "cash",
      synced: false,
    })
  })
}

export async function logAtm(
  who: Who,
  direction: "from" | "to",
  amount: number,
): Promise<void> {
  const wallet = await walletFor(who)
  if (!wallet?.id || amount <= 0) return
  const fromAtm = direction === "from"
  await db.transactions.add({
    date: new Date(),
    category: "other",
    type: fromAtm ? "in" : "out",
    amount,
    merchant: whoLabel(who),
    note: fromAtm ? ATM_IN_NOTE : ATM_OUT_NOTE,
    accountId: wallet.id,
    accountType: "cash",
    synced: false,
  })
}
