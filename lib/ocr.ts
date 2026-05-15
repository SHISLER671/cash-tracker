import Tesseract from "tesseract.js"

export interface ScanResult {
  amount: number
  merchant: string
  date: string
}

// === IMAGE PREPROCESSING (this is the magic fix) ===
async function preprocessImage(imageData: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      canvas.width = img.width
      canvas.height = img.height

      ctx.drawImage(img, 0, 0)

      // Get pixel data
      const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageDataObj.data

      // Grayscale + strong contrast boost + light binarization
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11
        // Boost contrast (makes text pop)
        const contrasted = Math.min(255, Math.max(0, (gray - 128) * 2.2 + 128))
        data[i] = data[i + 1] = data[i + 2] = contrasted
        data[i + 3] = 255
      }

      ctx.putImageData(imageDataObj, 0, 0)
      resolve(canvas.toDataURL("image/jpeg", 0.95))
    }
    img.src = imageData
  })
}

// === IMPROVED EXTRACTION (more forgiving) ===
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
  const lines = text.split("\n").filter((line) => line.trim().length > 2)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim()
    if (/^\d/.test(line) || /^(store|receipt|invoice|date|time|#|total)/i.test(line)) continue
    if (line.length >= 3 && line.length <= 50 && !/^\d+$/.test(line)) {
      return line.replace(/[^\w\s&'.-]/g, "").trim()
    }
  }
  return ""
}

const extractDate = (text: string): string => {
  const datePatterns = [
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
  ]
  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match && match[1]) return match[1]
  }
  return ""
}

// === MAIN SCAN FUNCTION ===
export const scanReceipt = async (imageData: string): Promise<ScanResult> => {
  try {
    console.log("🔍 Starting OCR on receipt...")

    const processedImage = await preprocessImage(imageData)
    console.log("✅ Image preprocessed for OCR")

    const result = await Tesseract.recognize(processedImage, "eng", {
      logger: (m) => console.log("Tesseract progress:", m),
      tessedit_pageseg_mode: 6, // uniform block of text (best for receipts)
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz$. /:-",
    })

    const text = result.data.text
    console.log("📄 RAW OCR TEXT:", text) // ← open console to see this!

    const amount = extractAmount(text)
    const merchant = extractMerchant(text)
    const date = extractDate(text)

    console.log(`✅ Extracted → $${amount} | ${merchant || "unknown merchant"}`)

    return { amount, merchant, date }
  } catch (error) {
    console.error("OCR failed:", error)
    return { amount: 0, merchant: "", date: "" }
  }
}
