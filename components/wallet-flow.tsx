"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { ArrowLeftRight } from "lucide-react"
import { cashBalances } from "@/lib/household"

function money(amount: number) {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function WalletFlow() {
  const balances = useLiveQuery(() => cashBalances(), [])

  return (
    <div className="card-luxe mb-6 p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Wallets
      </h2>
      <div className="flex items-stretch gap-2">
        <div className="flex-1 rounded-2xl border border-border-luxe bg-secondary/60 p-4">
          <p className="text-xs font-medium text-muted-foreground">Pia</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            ${money(balances?.pia ?? 0)}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center px-1 text-gold-dark">
          <ArrowLeftRight className="h-5 w-5" />
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider">Move</span>
        </div>
        <div className="flex-1 rounded-2xl border border-border-luxe bg-secondary/60 p-4 text-right">
          <p className="text-xs font-medium text-muted-foreground">Ryan</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            ${money(balances?.ryan ?? 0)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Tap + · Move · send cash between wallets
      </p>
    </div>
  )
}
