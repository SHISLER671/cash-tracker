import Tesseract from "tesseract.js"

export interface ScanResult {
  amount: number
  merchant: string
  date: string
}

// === STRONGER IMAGE PREPROCESSING (this should finally crack it) ===
async function preprocessImage(imageData: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!

      // 1. Resize to optimal width for OCR (1200px is the sweet spot for receipts)
      const MAX_WIDTH = 1200
      let { width, height } = img
      if (width > MAX_WIDTH) {
        const scale = MAX_WIDTH / width
        width = MAX_WIDTH
        height = Math.round(height * scale)
      }
      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      // 2. Get pixel data
      const imageDataObj = ctx.getImageData(0, 0, width, height)
      const data = imageDataObj.data

      // 3. Grayscale + aggressive contrast + binarization
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114

        // Strong contrast boost
        gray = Math.min(255, Math.max(0, (gray - 110) * 3 + 110))

        // Binarization: dark text on white background
        const threshold = 140
        const binary = gray < threshold ? 0 : 255

        data[i] = data[i + 1] = data[i + 2] = binary
        data[i + 3] = 255
      }

      ctx.putImageData(imageDataObj, 0, 0)

      // Optional: you can uncomment this to see the processed image in console
      // console.log("🖼️ Processed image ready (copy this base64 if you want to debug):", canvas.toDataURL("image/jpeg", 0.95))

      resolve(canvas.toDataURL("image/jpeg", 0.95))
    }
    img.src = imageData
  })
}

// === EXTRACTION (unchanged but slightly more forgiving) ===
const extractAmount = (text: string): number => {
  const normalized = text.toUpperCase()
  const patterns = [
    /TOTAL[^0-9]*(\d+\.\d{2})/i,
    /AMOUNT[^0-9]*(\d+\.\d{2})/i,
    /DUE[^0-9]*(\d+\.\d{2})/i,
    /BALANCE[^0-9]*(\d+\.\d{2})/i,
    /SUBTOTAL[^0-9]*(\d+\.\d{2})/i,
    /(\d+\.\d{2})\s*(?:TOTAL|AMOUNT|DUE|PAID|BALANCE|SUBTOTAL)/i,
    /\$\s*(\d+\.\d{2})/g,
  ]

  let amounts: number[] = []
  for (const pattern of patterns) {
    let matches
    if (pattern.global) {
      matches = [...normalized.matchAll(pattern)]
      for (const m of matches) {
        const amt = parseFloat((m[1] || m[0]).replace(/[^\d.]/g, ""))
        if (amt > 0 && amt < 10000) amounts.push(amt)
      }
    } else {
      matches = normalized.match(pattern)
      if (matches) {
        const amt = parseFloat((matches[1] || matches[0]).replace(/[^\d.]/g, ""))
        if (amt > 0 && amt < 10000) amounts.push(amt)
      }
    }
  }
  return amounts.length > 0 ? Math.max(...amounts) : 0
}

const extractMerchant = (text: string): string => {
  const lines = text.split("\n").filter((line) => line.trim().length > 3)
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i].trim()
    if (/^\d|total|amount|due|paid|subtotal|date|time/i.test(line)) continue
    if (line.length >= 4 && line.length <= 60) {
      return line.replace(/[^\w\s&'.-]/g, " ").trim()
    }
  }
  return "Unknown"
}

const extractDate = (text: string): string => {
  const patterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1]
  }
  return ""
}

// === MAIN SCAN ===
export const scanReceipt = async (imageData: string): Promise<ScanResult> => {
  try {
    console.log("🔍 Starting OCR on receipt...")

    const processedImage = await preprocessImage(imageData)
    console.log("✅ Image preprocessed for OCR (upscaled + binarized)")

    const result = await Tesseract.recognize(processedImage, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") console.log("Tesseract progress:", Math.round(m.progress * 100) + "%")
      },
      tessedit_pageseg_mode: 4,           // single column of text (best for receipts)
      tessedit_ocr_engine_mode: 1,        // LSTM only (more accurate)
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$. /:-,",
    })

    const text = result.data.text.trim()
    console.log("📄 RAW OCR TEXT:", text || "(empty)")

    const amount = extractAmount(text)
    const merchant = extractMerchant(text)
    const date = extractDate(text)

    console.log(`✅ Extracted → $${amount} | ${merchant || "unknown"}`)

    return { amount, merchant, date }
  } catch (error) {
    console.error("OCR failed:", error)
    return { amount: 0, merchant: "", date: "" }
  }
}
