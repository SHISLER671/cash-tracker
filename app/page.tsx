"use client"

import Link from "next/link"
import { useLiveQuery } from "dexie-react-hooks"
import { Settings, Clock } from "lucide-react"
import { db } from "@/lib/db"
import { CashDisplay } from "@/components/cash-display"
import { BudgetProgress } from "@/components/budget-progress"
import { AddButton } from "@/components/add-button"
import { EmptyState } from "@/components/empty-state"
import { format } from "date-fns"

// Default budget limits
const budgetLimits = {
  gas: 150,
  food: 400,
  medical: 200,
  other: 100,
}

export default function Home() {
  const currentMonth = format(new Date(), "yyyy-MM")

  // Get transaction count
  const transactionCount = useLiveQuery(async () => {
    return await db.transactions.count()
  }, [])

  // Calculate cash on hand from all transactions
  const cashOnHand = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    return all.reduce((acc, t) => acc + (t.type === "in" ? t.amount : -t.amount), 0)
  }, [])

  // Calculate spending by category for current month
  const spending = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    const monthStart = new Date(currentMonth + "-01")
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    const monthlyTransactions = all.filter(
      (t) => t.date >= monthStart && t.date < monthEnd && t.type === "out"
    )

    return {
      gas: monthlyTransactions
        .filter((t) => t.category === "gas")
        .reduce((sum, t) => sum + t.amount, 0),
      food: monthlyTransactions
        .filter((t) => t.category === "food")
        .reduce((sum, t) => sum + t.amount, 0),
      medical: monthlyTransactions
        .filter((t) => t.category === "medical")
        .reduce((sum, t) => sum + t.amount, 0),
      other: monthlyTransactions
        .filter((t) => t.category === "other")
        .reduce((sum, t) => sum + t.amount, 0),
    }
  }, [currentMonth])

  const budgets = [
    { label: "Gas", spent: spending?.gas ?? 0, budget: budgetLimits.gas },
    { label: "Food", spent: spending?.food ?? 0, budget: budgetLimits.food },
    { label: "Medical", spent: spending?.medical ?? 0, budget: budgetLimits.medical },
    { label: "Other", spent: spending?.other ?? 0, budget: budgetLimits.other },
  ]

  const isEmpty = transactionCount === 0

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border py-4">
          <Link
            href="/settings"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-earth transition-all hover:bg-secondary active:scale-95 active:bg-primary/20"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold text-foreground">Cash Tracker</h1>
          <Link
            href="/history"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-earth transition-all hover:bg-secondary active:scale-95 active:bg-primary/20"
            aria-label="View history"
          >
            <Clock className="h-5 w-5" />
          </Link>
        </header>

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            {/* Cash Display */}
            <CashDisplay amount={cashOnHand ?? 0} />

            {/* Budget Categories */}
            <section className="flex flex-col gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly Budgets
              </h2>
              <div className="flex flex-col gap-3">
                {budgets.map((budget) => (
                  <BudgetProgress
                    key={budget.label}
                    label={budget.label}
                    spent={budget.spent}
                    budget={budget.budget}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Floating Add Button */}
      <AddButton />
    </div>
  )
}
