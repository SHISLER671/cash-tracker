export interface ScanResult {
  amount: number
  merchant: string
  date: string
  category?: "gas" | "food" | "medical" | "other"
}

// Venice config
const VENICE_API_URL = "https://api.venice.ai/api/v1/chat/completions"
const MODELS_TO_TRY = ["qwen3-6-27b", "qwen3-vl-235b-a22b"]

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Helper to robustly extract JSON even if the model adds extra text
function extractJson(text: string): any {
  // Try to find JSON block
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {}
  }
  // Fallback: just try parsing the whole thing
  return JSON.parse(text)
}

async function callVeniceWithRetry(imageData: string): Promise<ScanResult> {
  const apiKey = process.env.NEXT_PUBLIC_VENICE_API_KEY
  if (!apiKey) throw new Error("No Venice API key")

  const base64 = imageData.replace(/^data:image\/\w+;base64,/, "")

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const model of MODELS_TO_TRY) {
      try {
        console.log(`🔄 Attempt ${attempt + 1}/3 → ${model}`)

        const response = await fetch(VENICE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are an expert receipt scanner. Extract ONLY from this photo. Return **nothing but valid JSON** (no explanations, no markdown, no extra text):

{
  "amount": number,
  "merchant": string,
  "date": string (YYYY-MM-DD or empty),
  "category": "gas" | "food" | "medical" | "other"
}`,
                },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${base64}` },
                },
              ],
            }],
            temperature: 0,
            max_tokens: 300,
            response_format: { type: "json_object" },
          }),
        })

        if (!response.ok) {
          const err = await response.text()
          if (response.status === 429) {
            console.log(`⏳ Overloaded — waiting...`)
            await sleep(2000)
            continue
          }
          throw new Error(err)
        }

        const data = await response.json()
        const raw = data.choices[0].message.content.trim()
        const parsed = extractJson(raw)

        const result: ScanResult = {
          amount: Number(parsed.amount) || 0,
          merchant: parsed.merchant || "Unknown",
          date: parsed.date || "",
          category: parsed.category || "other",
        }

        console.log("✅ Venice AI extracted:", result)
        return result

      } catch (err: any) {
        console.warn(`Model ${model} failed:`, err.message)
      }
    }
    if (attempt < 2) await sleep(1500)
  }

  throw new Error("All Venice attempts failed")
}

async function scanWithTesseract(): Promise<ScanResult> {
  console.log("Venice unavailable → Tesseract fallback")
  return { amount: 0, merchant: "Unknown", date: "" }
}

export const scanReceipt = async (imageData: string): Promise<ScanResult> => {
  console.log("🔍 Starting AI vision scan on receipt...")
  try {
    return await callVeniceWithRetry(imageData)
  } catch (error) {
    console.warn("Venice failed, falling back to Tesseract:", error)
    return await scanWithTesseract()
  }
}
