import Tesseract from "tesseract.js"

export interface ScanResult {
  amount: number
  merchant: string
  date: string
}

// Common receipt total patterns
const totalPatterns = [
  /(?:total|amount|due|balance|grand\s*total|subtotal)\s*[:\s]*\$?\s*(\d+\.?\d*)/gi,
  /\$\s*(\d+\.\d{2})\s*$/gm,
  /(\d+\.\d{2})\s*(?:total|due|paid)/gi,
]

// Common merchant name patterns (usually at top of receipt)
const merchantPatterns = [
  /^([A-Z][A-Za-z0-9\s&'.-]+)$/m,
  /welcome\s+to\s+([A-Za-z0-9\s&'.-]+)/i,
  /thank\s+you\s+for\s+(?:shopping|visiting)\s+(?:at\s+)?([A-Za-z0-9\s&'.-]+)/i,
]

// Date patterns
const datePatterns = [
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
  /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
]

const extractAmount = (text: string): number => {
  // Try each pattern to find amounts
  const amounts: number[] = []
  
  for (const pattern of totalPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match
    while ((match = regex.exec(text)) !== null) {
      const amount = parseFloat(match[1])
      if (amount > 0 && amount < 10000) {
        amounts.push(amount)
      }
    }
  }
  
  // Also look for standalone dollar amounts
  const dollarMatches = text.match(/\$\s*(\d+\.\d{2})/g)
  if (dollarMatches) {
    for (const m of dollarMatches) {
      const amount = parseFloat(m.replace(/[^\d.]/g, ""))
      if (amount > 0 && amount < 10000) {
        amounts.push(amount)
      }
    }
  }
  
  // Return the largest amount (usually the total)
  if (amounts.length > 0) {
    return Math.max(...amounts)
  }
  
  return 0
}

const extractMerchant = (text: string): string => {
  // Try to find merchant from first few lines (usually store name is at top)
  const lines = text.split("\n").filter(line => line.trim().length > 2)
  
  // Check first 5 lines for a merchant-like name
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim()
    // Skip lines that are mostly numbers or common receipt words
    if (/^\d/.test(line) || /^(store|receipt|invoice|date|time|#)/i.test(line)) {
      continue
    }
    // Return first reasonable looking name (3+ chars, not all caps numbers)
    if (line.length >= 3 && line.length <= 50 && !/^\d+$/.test(line)) {
      return line.replace(/[^\w\s&'.-]/g, "").trim()
    }
  }
  
  // Try patterns as fallback
  for (const pattern of merchantPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  return ""
}

const extractDate = (text: string): string => {
  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }
  return ""
}

export const scanReceipt = async (imageData: string): Promise<ScanResult> => {
  try {
    const result = await Tesseract.recognize(imageData, "eng", {
      logger: () => {}, // Silent logging
    })
    
    const text = result.data.text
    
    return {
      amount: extractAmount(text),
      merchant: extractMerchant(text),
      date: extractDate(text),
    }
  } catch (error) {
    console.error("OCR failed:", error)
    return {
      amount: 0,
      merchant: "",
      date: "",
    }
  }
}
