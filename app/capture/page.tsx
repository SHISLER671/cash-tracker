"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, X, RefreshCw, Pencil, Check, Upload } from "lucide-react"
import { CameraViewfinder } from "@/components/camera-viewfinder"
import { ProcessingOverlay } from "@/components/processing-overlay"
import { scanReceipt } from "@/lib/ocr"
import { db, addReceiptToInbox } from "@/lib/db"
import { syncNow } from "@/lib/supabase/sync"

type CaptureState = "camera" | "processing" | "results" | "error" | "bulk-categorize"
type Category = "gas" | "food" | "medical" | "other"

interface CapturedReceipt {
  imageData: string
  amount: number
  merchant?: string
  date?: string
}

const categoryConfig = {
  gas: { label: "GAS", color: "bg-primary" },
  food: { label: "FOOD", color: "bg-income" },
  medical: { label: "MED", color: "bg-expense" },
  other: { label: "OTHER", color: "bg-muted-foreground" },
}

function CapturePageSkeleton() {
  return (
    <div className="min-h-screen bg-foreground flex flex-col">
      <header className="flex items-center justify-between p-4 bg-foreground/90 backdrop-blur-sm">
        <div className="h-11 w-11 rounded-full bg-card/20 animate-pulse" />
        <div className="h-6 w-32 rounded bg-card/20 animate-pulse" />
        <div className="w-11" />
      </header>
      <div className="flex-1 flex items-center justify-center text-background/70">
        Loading...
      </div>
    </div>
  )
}

function CapturePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [state, setState] = useState<CaptureState>("camera")
  const [capturedReceipts, setCapturedReceipts] = useState<CapturedReceipt[]>([])
  const [errorMessage, setErrorMessage] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Auto-open gallery if user came from bottom sheet "Upload Saved Photo"
  useEffect(() => {
    const mode = searchParams.get("mode")
    if (mode === "upload") {
      setTimeout(() => {
        fileInputRef.current?.click()
      }, 300)
    }
  }, [searchParams])

  const handleCapture = async (imageData: string) => {
    setState("processing")
    try {
      const result = await scanReceipt(imageData)
      const receipt: CapturedReceipt = {
        imageData,
        amount: result.amount,
        merchant: result.merchant,
        date: result.date,
      }
      setCapturedReceipts(prev => [...prev, receipt])
      setState("camera")
    } catch (error) {
      console.error("OCR failed:", error)
      setErrorMessage("Failed to scan receipt")
      setState("error")
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setState("processing")
    const reader = new FileReader()
    reader.onload = async (event) => {
      const imageData = event.target?.result as string
      if (imageData) await handleCapture(imageData)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleDone = () => {
    if (capturedReceipts.length === 0) {
      router.push("/")
      return
    }
    setState("bulk-categorize")
  }

  const handleSaveToInbox = async () => {
    setIsSaving(true)
    for (const receipt of capturedReceipts) {
      await addReceiptToInbox({
        imageData: receipt.imageData,
        amount: receipt.amount,
        merchant: receipt.merchant,
      })
    }
    setIsSaving(false)
    router.push("/inbox")
  }

  const handleQuickCategorize = async (category: Category) => {
    setIsSaving(true)
    for (const receipt of capturedReceipts) {
      if (receipt.amount > 0) {
        await db.transactions.add({
          date: new Date(),
          category,
          type: "out",
          amount: receipt.amount,
          note: "Receipt scan",
          synced: false,
        })
      }
    }
    setIsSaving(false)
    // Push the newly captured transactions to Supabase / other devices.
    void syncNow()
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-foreground flex flex-col">
      <header className="flex items-center justify-between p-4 bg-foreground/90 backdrop-blur-sm">
        <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-full bg-card/20 text-background transition-all hover:bg-card/30 active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-background font-semibold">Add Receipt</h1>
        <div className="w-11" />
      </header>

      <div className="flex-1 flex flex-col relative">
        {state === "error" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background">
            <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-earth-lg text-center">
              <X className="h-12 w-12 text-expense mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">{"Can't read receipt"}</h2>
              <p className="text-muted-foreground mb-6">{errorMessage}</p>
              <button
                onClick={() => { setErrorMessage(""); setState("camera") }}
                className="w-full py-4 rounded-xl bg-secondary text-foreground font-semibold mb-3"
              >
                TRY AGAIN
              </button>
              <button
                onClick={() => router.push("/transaction")}
                className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold"
              >
                ENTER MANUALLY
              </button>
            </div>
          </div>
        ) : state === "bulk-categorize" ? (
          <div className="flex-1 flex flex-col bg-background p-4">
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {capturedReceipts.length} Receipt{capturedReceipts.length !== 1 ? "s" : ""} Captured
              </h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {capturedReceipts.map((receipt, index) => (
                  <div key={index} className="flex-shrink-0 w-20 h-28 rounded-lg bg-card shadow-earth overflow-hidden relative">
                    <img src={receipt.imageData} alt={`Receipt ${index + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute bottom-0 inset-x-0 bg-foreground/80 py-1 px-2">
                      <span className="text-xs font-semibold text-background">${receipt.amount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Categorize All</h2>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(categoryConfig) as [Category, typeof categoryConfig.gas][]).map(([cat, config]) => (
                  <button key={cat} onClick={() => handleQuickCategorize(cat)} disabled={isSaving} className={`flex items-center justify-center gap-2 py-4 rounded-xl ${config.color} text-white font-semibold transition-all hover:brightness-95 active:scale-98 disabled:opacity-50`}>
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto">
              <button onClick={handleSaveToInbox} disabled={isSaving} className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-secondary text-foreground font-semibold transition-all hover:bg-muted active:scale-98 disabled:opacity-50">
                {isSaving ? "SAVING..." : "SAVE TO INBOX FOR LATER"}
              </button>
              <p className="text-xs text-muted-foreground text-center mt-2">Categorize each receipt individually later</p>
            </div>
          </div>
        ) : (
          <>
            <CameraViewfinder onCapture={handleCapture} isProcessing={state === "processing"} />
            {state === "processing" && <ProcessingOverlay />}

            <div className="absolute bottom-0 left-0 right-0 px-4 pt-8 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-foreground via-foreground/95 to-transparent">
              <div className="flex gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-card text-foreground py-4 rounded-3xl font-semibold active:scale-95 transition-all"
                >
                  <Upload className="h-5 w-5" />
                  UPLOAD SAVED PHOTO
                </button>

                <button
                  onClick={handleDone}
                  className="flex-1 flex items-center justify-center gap-2 bg-income text-white py-4 rounded-3xl font-semibold active:scale-95 transition-all"
                >
                  <Check className="h-5 w-5" />
                  DONE {capturedReceipts.length > 0 && `(${capturedReceipts.length})`}
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default function CapturePage() {
  return (
    <Suspense fallback={<CapturePageSkeleton />}>
      <CapturePageContent />
    </Suspense>
  )
}
