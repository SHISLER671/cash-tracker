import Tesseract from "tesseract.js" // fallback only

export interface ScanResult {
  amount: number
  merchant: string
  date: string
  category?: "gas" | "food" | "medical" | "other"
}

// Venice API config
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions"
const VENICE_MODEL = "qwen3-vl-30b-a3b" // change to "e2ee-qwen3-vl-30b-a3b-p" if you prefer the private TEE version

// === AI VISION SCAN (main path) ===
async function scanWithVenice(imageData: string): Promise<ScanResult> {
  if (!process.env.NEXT_PUBLIC_VENICE_API_KEY) {
    throw new Error("No Venice key")
  }

  const base64 = imageData.replace(/^data:image\/\w+;base64,/, "")

  const response = await fetch(VENICE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_VENICE_API_KEY}`,
    },
    body: JSON.stringify({
      model: VENICE_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert receipt scanner. Extract the following from this receipt photo. Return ONLY valid JSON, no extra text.

{
  "amount": number (the total paid, e.g. 42.75),
  "merchant": string (store name, e.g. "Shell Gas" or "Walmart"),
  "date": string (in YYYY-MM-DD format if possible, otherwise leave empty),
  "category": "gas" | "food" | "medical" | "other"
}

Be accurate. If you can't find something, use sensible defaults (amount=0, merchant="Unknown", category="other").`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
              },
            },
          ],
        },
      ],
      temperature: 0.0,
      max_tokens: 300,
      response_format: { type: "json_object" },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Venice error: ${response.status} - ${err}`)
  }

  const data = await response.json()
  const jsonText = data.choices[0].message.content
  const parsed = JSON.parse(jsonText)

  return {
    amount: Number(parsed.amount) || 0,
    merchant: parsed.merchant || "Unknown",
    date: parsed.date || "",
    category: parsed.category || "other",
  }
}

// === FALLBACK (Tesseract) if no key or Venice fails ===
async function scanWithTesseract(imageData: string): Promise<ScanResult> {
  console.log("Venice not available → falling back to Tesseract")
  
  try {
    const result = await Tesseract.recognize(imageData, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") console.log("Tesseract progress:", Math.round(m.progress * 100) + "%")
      },
    })

    const text = result.data.text.trim()
    console.log("📄 RAW OCR TEXT:", text || "(empty)")

    // Basic extraction
    const amountMatch = text.match(/(\d+\.\d{2})/g)
    const amounts = amountMatch?.map(Number).filter(n => n > 0 && n < 10000) || []
    const amount = amounts.length > 0 ? Math.max(...amounts) : 0

    const lines = text.split("\n").filter(line => line.trim().length > 3)
    const merchant = lines[0]?.trim() || "Unknown"

    const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/)
    const date = dateMatch?.[1] || ""

    return { amount, merchant, date, category: "other" }
  } catch (error) {
    console.error("Tesseract OCR failed:", error)
    return { amount: 0, merchant: "Unknown", date: "", category: "other" }
  }
}

// === MAIN FUNCTION ===
export const scanReceipt = async (imageData: string): Promise<ScanResult> => {
  console.log("🔍 Starting AI vision scan on receipt...")

  try {
    // Try Venice AI first
    const result = await scanWithVenice(imageData)
    console.log("✅ Venice AI extracted:", result)
    return result
  } catch (error) {
    console.warn("Venice AI failed, trying Tesseract fallback:", error)
    return await scanWithTesseract(imageData)
  }
}
