"use client"

import { useState } from "react"
import { Plus, Camera, Upload, Edit3, X } from "lucide-react"
import { useRouter } from "next/navigation"

export function AddButton() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const handleOption = (path: string) => {
    setIsOpen(false)
    setTimeout(() => {
      router.push(path)
    }, 150)
  }

  return (
    <>
      {/* Floating + Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-white shadow-2xl shadow-primary/50 active:scale-95 transition-all hover:brightness-110 z-50"
      >
        <Plus className="h-8 w-8" />
      </button>

      {/* Bottom Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end bg-black/60" onClick={() => setIsOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-auto bg-white rounded-t-3xl shadow-2xl overflow-hidden"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-12 bg-muted-foreground/30 rounded-full" />
            </div>

            <div className="px-6 pb-6">
              <h2 className="text-center text-lg font-semibold text-foreground mb-6">Add New Receipt</h2>

              {/* Option 1: Take Photo */}
              <button
                onClick={() => handleOption("/capture")}
                className="w-full flex items-center gap-4 mb-4 p-5 rounded-3xl bg-card hover:bg-secondary active:scale-[0.98] transition-all text-left"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 text-3xl">📸</div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">Take New Photo</div>
                  <div className="text-sm text-muted-foreground">Live camera - instant scan</div>
                </div>
              </button>

              {/* Option 2: Upload Saved Photo */}
              <button
                onClick={() => handleOption("/capture?mode=upload")}
                className="w-full flex items-center gap-4 mb-4 p-5 rounded-3xl bg-card hover:bg-secondary active:scale-[0.98] transition-all text-left"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 text-3xl">📁</div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">Upload Saved Photo</div>
                  <div className="text-sm text-muted-foreground">Pick from your camera roll</div>
                </div>
              </button>

              {/* Option 3: Manual Entry */}
              <button
                onClick={() => handleOption("/transaction")}
                className="w-full flex items-center gap-4 p-5 rounded-3xl bg-card hover:bg-secondary active:scale-[0.98] transition-all text-left"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 text-3xl">✍️</div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">Type It In</div>
                  <div className="text-sm text-muted-foreground">No photo needed</div>
                </div>
              </button>
            </div>

            {/* Cancel */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-6 text-muted-foreground font-medium border-t border-border active:bg-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
