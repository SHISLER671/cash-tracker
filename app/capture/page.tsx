"use client"

import { useState } from "react"
import { CameraViewfinder } from "@/components/camera-viewfinder"
import { ExtractedAmounts } from "@/components/extracted-amounts"
import { ProcessingOverlay } from "@/components/processing-overlay"
import Link from "next/link"

type CaptureState = "camera" | "processing" | "results"

interface ExtractedAmount {
  label: string
  amount: number
}

export default function CapturePage() {
  const [state, setState] = useState<CaptureState>("camera")
  const [extractedAmounts, setExtractedAmounts] = useState<ExtractedAmount[]>([])

  const handleCapture = async (_imageData: string) => {
    setState("processing")

    // Simulate OCR processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Simulated extracted amounts
    const mockAmounts: ExtractedAmount[] = [
      { label: "Subtotal", amount: 45.99 },
      { label: "Tax", amount: 3.68 },
      { label: "Tip", amount: 9.00 },
    ]

    setExtractedAmounts(mockAmounts)
    setState("results")
  }

  const handleRetry = () => {
    setExtractedAmounts([])
    setState("camera")
  }

  const handleConfirm = () => {
    // In a real app, this would save to database
    // For now, just go back to dashboard
    window.location.href = "/"
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
