"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { db } from "@/lib/db"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export default function ReportPage() {
  const router = useRouter()
  const currentMonth = format(new Date(), "yyyy-MM")

  const monthlyData = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    const monthStart = startOfMonth(new Date())
    const monthEnd = endOfMonth(new Date())

    const monthlyTransactions = all.filter(t => 
      t.date >= monthStart && t.date <= monthEnd && t.type === "out"
    )

    const byCategory = {
      gas: monthlyTransactions.filter(t => t.category.toLowerCase() === "gas").reduce((sum, t) => sum + t.amount, 0),
      food: monthlyTransactions.filter(t => t.category.toLowerCase() === "food").reduce((sum, t) => sum + t.amount, 0),
      medical: monthlyTransactions.filter(t => t.category.toLowerCase() === "medical").reduce((sum, t) => sum + t.amount, 0),
      other: monthlyTransactions.filter(t => !["gas","food","medical"].includes(t.category.toLowerCase())).reduce((sum, t) => sum + t.amount, 0),
    }

    const totalSpent = Object.values(byCategory).reduce((sum, v) => sum + v, 0)

    const chartData = Object.entries(byCategory).map(([category, amount]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      amount: amount,
    }))

    return { chartData, byCategory, totalSpent }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border py-4 px-4">
        <button
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-earth transition-all hover:bg-secondary active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Monthly Report</h1>
        <div className="w-11" />
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <div className="mb-8 text-center">
          <p className="text-sm text-muted-foreground">This Month</p>
          <p className="text-4xl font-bold text-expense">
            -${monthlyData?.totalSpent.toFixed(2) ?? "0.00"}
          </p>
        </div>

        {monthlyData && monthlyData.chartData.length > 0 ? (
          <div className="bg-card rounded-3xl p-6 shadow-earth">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#f43f5e" radius={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-12">No spending this month yet</p>
        )}

        <div className="mt-8 space-y-4">
          {monthlyData && Object.entries(monthlyData.byCategory).map(([cat, amount]) => (
            <div key={cat} className="flex justify-between items-center">
              <span className="capitalize font-medium">{cat}</span>
              <span className="font-semibold text-expense">-${amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
