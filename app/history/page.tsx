"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Transaction } from "@/lib/types"
import { TransactionList } from "@/components/transaction-list"

// Sample data - in a real app this would come from a database
const sampleTransactions: Transaction[] = [
  {
    id: "1",
    type: "out",
    amount: 45.50,
    category: "gas",
    date: new Date(),
    note: "Shell Station",
  },
  {
    id: "2",
    type: "out",
    amount: 32.75,
    category: "food",
    date: new Date(),
  },
  {
    id: "3",
    type: "in",
    amount: 500.00,
    category: "other",
    date: new Date(),
    note: "ATM Deposit",
  },
  {
    id: "4",
    type: "out",
    amount: 15.99,
    category: "medical",
    date: new Date(Date.now() - 86400000), // Yesterday
    note: "CVS Pharmacy",
  },
  {
    id: "5",
    type: "out",
    amount: 67.23,
    category: "food",
    date: new Date(Date.now() - 86400000), // Yesterday
  },
  {
    id: "6",
    type: "in",
    amount: 200.00,
    category: "other",
    date: new Date(Date.now() - 86400000 * 2), // 2 days ago
    note: "Cash Back",
  },
  {
    id: "7",
    type: "out",
    amount: 89.00,
    category: "gas",
    date: new Date(Date.now() - 86400000 * 3), // 3 days ago
  },
  {
    id: "8",
    type: "out",
    amount: 124.50,
    category: "other",
    date: new Date(Date.now() - 86400000 * 5), // 5 days ago
    note: "Home Depot",
  },
]

export default function HistoryPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>(sampleTransactions)
  
  const handleRefresh = useCallback(async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    // In a real app, you would fetch fresh data here
    setTransactions([...sampleTransactions])
  }, [])
  
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-zinc-800">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
          aria-label="Go back"
        >
          <svg className="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h1 className="text-xl font-bold text-zinc-100">History</h1>
        
        <div className="w-10" /> {/* Spacer for centering */}
      </header>
      
      {/* Summary */}
      <div className="flex items-center justify-center gap-8 p-4 border-b border-zinc-800">
        <div className="text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Income</p>
          <p className="text-lg font-bold text-emerald-400">
            +${transactions.filter(t => t.type === "in").reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
          </p>
        </div>
        <div className="w-px h-8 bg-zinc-800" />
        <div className="text-center">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Expenses</p>
          <p className="text-lg font-bold text-red-400">
            -${transactions.filter(t => t.type === "out").reduce((sum, t) => sum + t.amount, 0).toFixed(2)}
          </p>
        </div>
      </div>
      
      {/* Transaction List */}
      <TransactionList 
        transactions={transactions} 
        onRefresh={handleRefresh}
      />
    </div>
  )
}
