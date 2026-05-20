"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, X, RefreshCw, Pencil, Check, Camera, Upload } from "lucide-react"
import { CameraViewfinder } from "@/components/camera-viewfinder"
import { ProcessingOverlay } from "@/components/processing-overlay"
import { scanReceipt } from "@/lib/ocr"
import { db, addReceiptToInbox } from "@/lib/db"

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

export default function CapturePage() {
  const router = useRouter()
  const [state, setState] = useState<CaptureState>("camera")
  const [capturedReceipts, setCapturedReceipts] = useState<CapturedReceipt[]>([])
  const [errorMessage, setErrorMessage] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // New: File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // New: Upload from gallery
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setState("processing")

    const reader = new FileReader()
    reader.onload = async (event) => {
      const imageData = event.target?.result as string
      if (imageData) {
        await handleCapture(imageData)
      }
    }
    reader.readAsDataURL(file)

    // Reset input so the same file can be selected again
    e.target.value = ""
  }

  const handleDone = () => {
    if (capturedReceipts.length === 0) {
      router.push("/")
      return
    }
    setState("bulk-categorize")
  }

  const handleRetry = () => {
    setErrorMessage("")
    setState("camera")
  }

  const handleManualEntry = () => {
    router.push("/transaction")
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
        })
      }
    }
    setIsSaving(false)
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-foreground flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-foreground/90 backdrop-blur-sm">
        <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-full bg-card/20 text-background transition-all hover:bg-card/30 active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-background font-semibold">
          {state === "bulk-categorize" ? "Categorize Receipts" : "Capture Receipts"}
        </h1>
        <div className="w-11" />
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
              <h2 className="text-xl font-bold text-foreground text-center mb-2">{"Can't read receipt"}</h2>
              <p className="text-muted-foreground text-center text-sm mb-6">{errorMessage}</p>
              <div className="flex flex-col gap-3">
                <button onClick={handleManualEntry} className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold transition-all hover:brightness-95 active:scale-98">
                  <Pencil className="h-5 w-5" />
                  ENTER MANUALLY
                </button>
                <button onClick={handleRetry} className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-secondary text-foreground font-semibold transition-all hover:bg-muted active:scale-98">
                  <RefreshCw className="h-5 w-5" />
                  TRY AGAIN
                </button>
              </div>
            </div>
          </div>
        ) : state === "bulk-categorize" ? (
          <div className="flex-1 flex flex-col bg-background p-4">
            <div className="mb-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {capturedReceipts.length} Receipt{capturedReceipts.length !== 1 ? 's' : ''} Captured
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

            {/* Bottom controls - now includes Upload button */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-foreground via-foreground/90 to-transparent">
              <div className="flex items-center justify-between gap-3">
                {/* Upload from Gallery */}
                <button
                  onClick={handleUploadClick}
                  disabled={state === "processing"}
                  className="flex-1 flex items-center justify-center gap-2 bg-card text-foreground py-4 rounded-3xl font-semibold transition-all hover:bg-secondary active:scale-95 disabled:opacity-50"
                >
                  <Upload className="h-5 w-5" />
                  UPLOAD PHOTO
                </button>

                {/* Done button */}
                <button
                  onClick={handleDone}
                  disabled={state === "processing"}
                  className="flex-1 flex items-center justify-center gap-2 bg-income text-white py-4 rounded-3xl font-semibold transition-all hover:brightness-95 active:scale-95 disabled:opacity-50"
                >
                  <Check className="h-5 w-5" />
                  DONE {capturedReceipts.length > 0 && `(${capturedReceipts.length})`}
                </button>
              </div>
            </div>

            {/* Hidden file input */}
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
