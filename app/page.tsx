import Link from "next/link";
import { CashDisplay } from "@/components/cash-display";
import { BudgetProgress } from "@/components/budget-progress";
import { AddButton } from "@/components/add-button";

// Sample data - in a real app this would come from a database
const budgets = [
  { label: "Gas", spent: 85, budget: 150 },
  { label: "Food", spent: 320, budget: 400 },
  { label: "Medical", spent: 180, budget: 200 },
  { label: "Other", spent: 45, budget: 100 },
];

const cashOnHand = 1247.53;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border py-4">
          <div className="w-10" />
          <h1 className="text-lg font-semibold text-foreground">
            Cash Tracker
          </h1>
          <Link 
            href="/history"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700"
            aria-label="View history"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </Link>
        </header>

        {/* Cash Display */}
        <CashDisplay amount={cashOnHand} />

        {/* Budget Categories */}
        <section className="flex flex-col gap-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Budget Categories
          </h2>
          <div className="flex flex-col gap-5">
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
      </main>

      {/* Floating Add Button */}
      <AddButton />
    </div>
  );
}
