"use client"

import { useState, useCallback, useRef } from "react"
import { Transaction } from "@/lib/types"
import { TransactionGroup } from "./transaction-group"
import { cn } from "@/lib/utils"

interface TransactionListProps {
  transactions: Transaction[]
  onRefresh?: () => Promise<void>
}

function groupTransactionsByDate(transactions: Transaction[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  const groups: { today: Transaction[]; yesterday: Transaction[]; earlier: Transaction[] } = {
    today: [],
    yesterday: [],
    earlier: [],
  }
  
  transactions.forEach((transaction) => {
    const transactionDate = new Date(transaction.date)
    transactionDate.setHours(0, 0, 0, 0)
    
    if (transactionDate.getTime() === today.getTime()) {
      groups.today.push(transaction)
    } else if (transactionDate.getTime() === yesterday.getTime()) {
      groups.yesterday.push(transaction)
    } else {
      groups.earlier.push(transaction)
    }
  })
  
  return groups
}

export function TransactionList({ transactions, onRefresh }: TransactionListProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const isPulling = useRef(false)
  
  const REFRESH_THRESHOLD = 80
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }, [])
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return
    
    const currentY = e.touches[0].clientY
    const distance = Math.max(0, currentY - startY.current)
    
    if (distance > 0 && containerRef.current?.scrollTop === 0) {
      setPullDistance(Math.min(distance * 0.5, 120))
    }
  }, [isRefreshing])
  
  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return
    isPulling.current = false
    
    if (pullDistance >= REFRESH_THRESHOLD && onRefresh) {
      setIsRefreshing(true)
      await onRefresh()
      setIsRefreshing(false)
    }
    
    setPullDistance(0)
  }, [pullDistance, onRefresh])
  
  const groups = groupTransactionsByDate(transactions)
  const hasTransactions = transactions.length > 0
  
  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden transition-all duration-200",
          isRefreshing ? "h-12" : "h-0"
        )}
        style={{ height: isRefreshing ? 48 : pullDistance }}
      >
        <div className={cn(
          "flex items-center gap-2 text-zinc-400 transition-opacity",
          pullDistance >= REFRESH_THRESHOLD || isRefreshing ? "opacity-100" : "opacity-50"
        )}>
          <svg
            className={cn("w-5 h-5", isRefreshing && "animate-spin")}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm font-medium">
            {isRefreshing ? "Refreshing..." : pullDistance >= REFRESH_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>
      
      {/* Transaction list */}
      <div className="p-4 space-y-6">
        {hasTransactions ? (
          <>
            <TransactionGroup label="Today" transactions={groups.today} />
            <TransactionGroup label="Yesterday" transactions={groups.yesterday} />
            <TransactionGroup label="Earlier" transactions={groups.earlier} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-zinc-400 font-medium">No transactions yet</p>
            <p className="text-zinc-600 text-sm mt-1">Tap + to add your first transaction</p>
          </div>
        )}
      </div>
    </div>
  )
}
