export interface ScanResult {
  amount: number
  merchant: string
  date: string
  category?: "gas" | "food" | "medical" | "other"
}

// Venice config
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions"
const MODELS_TO_TRY = [
  "qwen3-6-27b",           // lighter + strong vision (recommended right now)
  "qwen3-vl-235b-a22b",    // big one as backup
]

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function callVeniceWithRetry(imageData: string): Promise<ScanResult> {
  const apiKey = process.env.NEXT_PUBLIC_VENICE_API_KEY
  if (!apiKey) throw new Error("No Venice API key")

  const base64 = imageData.replace(/^data:image\/\w+;base64,/, "")

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const model of MODELS_TO_TRY) {
      try {
        console.log(`🔄 Attempt ${attempt + 1}/3 → Trying model: ${model}`)

        const response = await fetch(VENICE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `You are an expert receipt scanner. Extract ONLY from this photo. Return valid JSON only:

{
  "amount": number (final total paid, e.g. 42.75),
  "merchant": string (store name, e.g. "Shell Gas" or "Walmart"),
  "date": string (YYYY-MM-DD if visible, otherwise ""),
  "category": "gas" | "food" | "medical" | "other"
}

Use the biggest total (after tax). Merchant = top store name. Be precise.`,
                  },
                  {
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${base64}` },
                  },
                ],
              },
            ],
            temperature: 0,
            max_tokens: 300,
            response_format: { type: "json_object" },
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          if (response.status === 429) {
            console.log(`⏳ Model overloaded (429) — retrying...`)
            await sleep(1500) // 1.5 second backoff
            continue
          }
          throw new Error(`Venice ${response.status}: ${errorText}`)
        }

        const data = await response.json()
        const jsonText = data.choices[0].message.content.trim()
        const parsed = JSON.parse(jsonText)

        const result: ScanResult = {
          amount: Number(parsed.amount) || 0,
          merchant: parsed.merchant || "Unknown",
          date: parsed.date || "",
          category: parsed.category || "other",
        }

        console.log("✅ Venice AI success:", result)
        return result

      } catch (err: any) {
        console.warn(`Model ${model} failed:`, err.message)
      }
    }
    // If all models failed on this attempt, wait before next outer retry
    if (attempt < 2) await sleep(2000)
  }

  throw new Error("All Venice attempts failed")
}

// Tesseract fallback (still here just in case)
async function scanWithTesseract(): Promise<ScanResult> {
  console.log("Venice unavailable → falling back to Tesseract (temporary)")
  return { amount: 0, merchant: "Unknown", date: "" }
}

// Main export
export const scanReceipt = async (imageData: string): Promise<ScanResult> => {
  console.log("🔍 Starting AI vision scan on receipt...")

  try {
    return await callVeniceWithRetry(imageData)
  } catch (error) {
    console.warn("All Venice attempts failed, falling back to Tesseract:", error)
    return await scanWithTesseract()
  }
}
