"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CameraViewfinder } from "@/components/camera-viewfinder"
import { ExtractedAmounts } from "@/components/extracted-amounts"
import { ProcessingOverlay } from "@/components/processing-overlay"
import { scanReceipt } from "@/lib/ocr"
import { db } from "@/lib/db"

type CaptureState = "camera" | "processing" | "results"

interface ExtractedAmount {
  label: string
  amount: number
}

export default function CapturePage() {
  const router = useRouter()
  const [state, setState] = useState<CaptureState>("camera")
  const [extractedAmounts, setExtractedAmounts] = useState<ExtractedAmount[]>([])
  const [totalAmount, setTotalAmount] = useState(0)

  const handleCapture = async (imageData: string) => {
    setState("processing")

    try {
      const result = await scanReceipt(imageData)
      
      const amounts: ExtractedAmount[] = []
      
      if (result.amounts.length > 0) {
        // Show individual amounts found
        result.amounts.forEach((amt, idx) => {
          if (amt === result.total) {
            amounts.push({ label: "Total", amount: amt })
          } else {
            amounts.push({ label: `Item ${idx + 1}`, amount: amt })
          }
        })
      }
      
      // Ensure total is shown
      if (!amounts.find(a => a.label === "Total") && result.total > 0) {
        amounts.push({ label: "Total", amount: result.total })
      }

      setExtractedAmounts(amounts.length > 0 ? amounts : [{ label: "Total", amount: 0 }])
      setTotalAmount(result.total)
      setState("results")
    } catch (error) {
      console.error("OCR failed:", error)
      // Fallback to manual entry
      setExtractedAmounts([{ label: "Total", amount: 0 }])
      setTotalAmount(0)
      setState("results")
    }
  }

  const handleRetry = () => {
    setExtractedAmounts([])
    setTotalAmount(0)
    setState("camera")
  }

  const handleConfirm = async () => {
    if (totalAmount > 0) {
      // Save as an expense with "other" category - user can edit later
      await db.transactions.add({
        date: new Date(),
        category: "other",
        type: "out",
        amount: totalAmount,
        note: "Receipt scan",
      })
    }
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-zinc-900/80 backdrop-blur-sm">
        <Link
          href="/"
          className="text-white p-2 -ml-2 active:bg-zinc-800 rounded-lg transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <h1 className="text-white font-semibold">Capture Receipt</h1>
        <div className="w-10" />
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col relative">
        {state === "results" ? (
          <ExtractedAmounts
            amounts={extractedAmounts}
            onConfirm={handleConfirm}
            onRetry={handleRetry}
          />
        ) : (
          <>
            <CameraViewfinder
              onCapture={handleCapture}
              isProcessing={state === "processing"}
            />
            {state === "processing" && <ProcessingOverlay />}
          </>
        )}
      </div>
    </div>
  )
}
