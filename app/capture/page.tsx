"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, X, RefreshCw, Pencil } from "lucide-react"
import { CameraViewfinder } from "@/components/camera-viewfinder"
import { ExtractedAmounts } from "@/components/extracted-amounts"
import { ProcessingOverlay } from "@/components/processing-overlay"
import { scanReceipt } from "@/lib/ocr"
import { db } from "@/lib/db"

type CaptureState = "camera" | "processing" | "results" | "error"
type Category = "gas" | "food" | "medical" | "other"

export default function CapturePage() {
  const router = useRouter()
  const [state, setState] = useState<CaptureState>("camera")
  const [extractedAmount, setExtractedAmount] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")

  const handleCapture = async (imageData: string) => {
    setState("processing")

    try {
      const result = await scanReceipt(imageData)
      if (result.total <= 0) {
        setErrorMessage("Could not read amount from receipt")
        setState("error")
        return
      }
      setExtractedAmount(result.total)
      setState("results")
    } catch (error) {
      console.error("OCR failed:", error)
      setErrorMessage("Camera permission denied or OCR failed")
      setState("error")
    }
  }

  const handleRetry = () => {
    setExtractedAmount(0)
    setErrorMessage("")
    setState("camera")
  }

  const handleManualEntry = () => {
    router.push("/transaction")
  }

  const handleConfirm = async (category: Category) => {
    if (extractedAmount > 0) {
      await db.transactions.add({
        date: new Date(),
        category: category,
        type: "out",
        amount: extractedAmount,
        note: "Receipt scan",
      })
    }
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-foreground flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-foreground/90 backdrop-blur-sm">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card/20 text-background transition-colors hover:bg-card/30"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-background font-semibold">Capture Receipt</h1>
        <div className="w-10" />
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col relative">
        {state === "error" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background">
            <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-earth-lg">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-expense/10">
                  <X className="h-8 w-8 text-expense" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-foreground text-center mb-2">
                {"Can't read receipt"}
              </h2>
              <p className="text-muted-foreground text-center text-sm mb-6">
                {errorMessage}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleManualEntry}
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold transition-all hover:brightness-95 active:scale-98"
                >
                  <Pencil className="h-5 w-5" />
                  ENTER MANUALLY
                </button>
                <button
                  onClick={handleRetry}
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-secondary text-foreground font-semibold transition-all hover:bg-muted active:scale-98"
                >
                  <RefreshCw className="h-5 w-5" />
                  TRY AGAIN
                </button>
                <Link
                  href="/"
                  className="flex items-center justify-center w-full py-3 text-muted-foreground font-medium transition-colors hover:text-foreground"
                >
                  CANCEL
                </Link>
              </div>
            </div>
          </div>
        ) : state === "results" ? (
          <ExtractedAmounts
            amount={extractedAmount}
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
