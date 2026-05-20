"use client"

import { useLiveQuery } from "dexie-react-hooks"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react"
import { db } from "@/lib/db"
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export default function ReportPage() {
  const router = useRouter()
  const [insights, setInsights] = useState<string>("")
  const [loadingInsights, setLoadingInsights] = useState(false)

  const currentMonth = format(new Date(), "yyyy-MM")
  const lastMonthTotal = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    const monthStart = startOfMonth(subMonths(new Date(), 1))
    const monthEnd = endOfMonth(subMonths(new Date(), 1))
    const monthly = all.filter(t => t.date >= monthStart && t.date <= monthEnd && t.type === "out")
    return monthly.reduce((sum, t) => sum + t.amount, 0)
  }, [])

  const thisMonthData = useLiveQuery(async () => {
    const all = await db.transactions.toArray()
    const monthStart = startOfMonth(new Date())
    const monthEnd = endOfMonth(new Date())

    const monthly = all.filter(t => t.date >= monthStart && t.date <= monthEnd && t.type === "out")

    const byCategory = {
      gas: monthly.filter(t => t.category.toLowerCase() === "gas").reduce((sum, t) => sum + t.amount, 0),
      food: monthly.filter(t => t.category.toLowerCase() === "food").reduce((sum, t) => sum + t.amount, 0),
      medical: monthly.filter(t => t.category.toLowerCase() === "medical").reduce((sum, t) => sum + t.amount, 0),
      other: monthly.filter(t => !["gas","food","medical"].includes(t.category.toLowerCase())).reduce((sum, t) => sum + t.amount, 0),
    }

    const total = Object.values(byCategory).reduce((sum, v) => sum + v, 0)

    const chartData = Object.entries(byCategory).map(([cat, amount]) => ({
      category: cat.charAt(0).toUpperCase() + cat.slice(1),
      amount,
    }))

    return { total, byCategory, chartData }
  }, [])

  // Generate AI insights only if we have data
  useEffect(() => {
    const generateInsights = async () => {
      if (!thisMonthData || thisMonthData.total === 0) {
        setInsights("Start tracking more receipts to get personalized saving tips!")
        return
      }

      setLoadingInsights(true)

      const prompt = `You are a kind, encouraging financial coach helping a couple save money.

This month's spending:
Total: $${thisMonthData.total.toFixed(2)}
Last month: $${(lastMonthTotal || 0).toFixed(2)}

Breakdown:
${Object.entries(thisMonthData.byCategory).map(([cat, amt]) => `- ${cat}: $${amt.toFixed(2)}`).join("\n")}

Give 2-3 short, actionable, friendly insights that help them save money this month. Focus on easy wins and trends. Be positive and specific.`

      try {
        const response = await fetch("https://api.venice.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_VENICE_API_KEY || ""}`,
          },
          body: JSON.stringify({
            model: "qwen3-6-27b",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 400,
          }),
        })

        if (!response.ok) throw new Error("API error")

        const data = await response.json()
        const text = data.choices[0].message.content.trim()
        setInsights(text)
      } catch (e) {
        console.warn("AI insights skipped (no key or network issue)")
        setInsights("You're doing great by tracking your spending! Small changes add up.")
      } finally {
        setLoadingInsights(false)
      }
    }

    generateInsights()
  }, [thisMonthData, lastMonthTotal])

  const percentChange = lastMonthTotal ? ((thisMonthData?.total || 0) - lastMonthTotal) / lastMonthTotal * 100 : 0

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border py-4 px-4">
        <button onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground shadow-earth transition-all hover:bg-secondary active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Monthly Report</h1>
        <div className="w-11" />
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <div className="mb-8 text-center">
          <p className="text-sm text-muted-foreground">This Month</p>
          <p className="text-5xl font-bold text-expense">
            -${thisMonthData?.total.toFixed(2) ?? "0.00"}
          </p>
          {lastMonthTotal !== undefined && (
            <p className={`text-sm flex items-center justify-center gap-1 ${percentChange > 0 ? "text-expense" : "text-income"}`}>
              {percentChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {percentChange.toFixed(1)}% from last month
            </p>
          )}
        </div>

        {thisMonthData && thisMonthData.chartData.length > 0 && (
          <div className="bg-card rounded-3xl p-6 shadow-earth mb-8">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={thisMonthData.chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#f43f5e" radius={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="bg-card rounded-3xl p-6 shadow-earth">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            Smart Insights
          </h3>
          {loadingInsights ? (
            <p className="text-muted-foreground">Analyzing your spending to find saving opportunities...</p>
          ) : (
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">{insights}</p>
          )}
        </div>
      </main>
    </div>
  )
}
