"use client"

import { useState, useCallback, useRef } from "react"
import { RefreshCw, ClipboardList } from "lucide-react"
import { Transaction } from "@/lib/types"
import { TransactionGroup } from "./transaction-group"
import { cn } from "@/lib/utils"

interface TransactionListProps {
  transactions: Transaction[]
  onRefresh?: () => Promise<void>
  onEdit?: (transaction: Transaction) => void
  possibleDuplicates?: any[]
  onFlagClick?: (dup: any) => void
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

export function TransactionList({ transactions, onRefresh, onEdit, possibleDuplicates, onFlagClick }: TransactionListProps) {
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
          "flex items-center gap-2 text-muted-foreground transition-opacity",
          pullDistance >= REFRESH_THRESHOLD || isRefreshing ? "opacity-100" : "opacity-50"
        )}>
          <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
          <span className="text-sm font-medium">
            {isRefreshing ? "Refreshing..." : pullDistance >= REFRESH_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>
      
      {/* Transaction list */}
      <div className="p-4 space-y-6">
        {hasTransactions ? (
          <>
            <TransactionGroup label="Today" transactions={groups.today} onEdit={onEdit} possibleDuplicates={possibleDuplicates} onFlagClick={onFlagClick} />
            <TransactionGroup label="Yesterday" transactions={groups.yesterday} onEdit={onEdit} possibleDuplicates={possibleDuplicates} onFlagClick={onFlagClick} />
            <TransactionGroup label="Earlier" transactions={groups.earlier} onEdit={onEdit} possibleDuplicates={possibleDuplicates} onFlagClick={onFlagClick} />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mb-4 shadow-earth">
              <ClipboardList className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium">No transactions yet</p>
            <p className="text-muted-foreground text-sm mt-1">Tap + to add your first transaction</p>
          </div>
        )}
      </div>
    </div>
  )
}
