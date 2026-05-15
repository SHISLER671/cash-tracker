"use client"

import { useState, useRef, useCallback } from "react"
import { Plus, Camera, Pencil } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const quickAmounts = [20, 50, 100]

export function AddButton() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const touchStartPos = useRef({ x: 0, y: 0 })

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
    longPressTimer.current = setTimeout(() => {
      setShowQuickAdd(true)
      if (navigator.vibrate) {
        navigator.vibrate(30)
      }
    }, 500)
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    
    if (showQuickAdd) {
      // Check if finger released on a quick amount
      const touch = e.changedTouches[0]
      const element = document.elementFromPoint(touch.clientX, touch.clientY)
      const quickAmountEl = element?.closest('[data-quick-amount]')
      
      if (quickAmountEl) {
        const amount = quickAmountEl.getAttribute('data-quick-amount')
        if (amount === 'other') {
          router.push('/transaction')
        } else {
          router.push(`/transaction?amount=${amount}`)
        }
      }
      
      setShowQuickAdd(false)
    }
  }, [showQuickAdd, router])

  const handleTouchMove = useCallback(() => {
    // Don't cancel on small movements
  }, [])

  const handleClick = () => {
    if (!showQuickAdd) {
      setIsOpen(!isOpen)
    }
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-40">
        {/* Sub-buttons */}
        <div
          className={cn(
            "flex flex-col items-end gap-3 transition-all duration-200",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          )}
        >
          <Link
            href="/capture"
            className="flex items-center gap-3 group"
            onClick={() => setIsOpen(false)}
          >
            <span className="bg-card text-foreground text-sm font-medium px-3 py-1.5 rounded-lg shadow-earth opacity-0 group-hover:opacity-100 transition-opacity">
              Scan Receipt
            </span>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground shadow-earth transition-all hover:bg-primary hover:text-primary-foreground active:scale-90">
              <Camera className="h-5 w-5" />
            </div>
          </Link>
          <Link
            href="/transaction"
            className="flex items-center gap-3 group"
            onClick={() => setIsOpen(false)}
          >
            <span className="bg-card text-foreground text-sm font-medium px-3 py-1.5 rounded-lg shadow-earth opacity-0 group-hover:opacity-100 transition-opacity">
              Manual Entry
            </span>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-foreground shadow-earth transition-all hover:bg-primary hover:text-primary-foreground active:scale-90">
              <Pencil className="h-5 w-5" />
            </div>
          </Link>
        </div>

        {/* Main FAB */}
        <button
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-earth-lg transition-all hover:brightness-95 hover:shadow-xl active:scale-90",
            isOpen && "rotate-45"
          )}
          aria-label={isOpen ? "Close menu" : "Add transaction"}
        >
          <Plus className="h-7 w-7 transition-transform duration-200" strokeWidth={2.5} />
        </button>
      </div>

      {/* Quick Add Radial Menu */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6">
          <div className="absolute inset-0 bg-foreground/30" />
          <div className="relative">
            {/* Quick amount buttons positioned radially around finger */}
            <div className="absolute bottom-20 right-0 flex gap-3">
              {quickAmounts.map((amount) => (
                <div
                  key={amount}
                  data-quick-amount={amount}
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-foreground font-bold shadow-earth-lg"
                >
                  ${amount}
                </div>
              ))}
              <div
                data-quick-amount="other"
                className="flex h-14 px-4 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-earth-lg"
              >
                OTHER
              </div>
            </div>
            
            {/* FAB placeholder */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-earth-lg">
              <Plus className="h-8 w-8" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
