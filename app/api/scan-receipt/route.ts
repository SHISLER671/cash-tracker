import { NextRequest, NextResponse } from "next/server"

export interface VeniceScanResult {
  amount: number
  merchant: string
  date: string
}

export async function POST(request: NextRequest) {
  try {
    const { base64Image } = await request.json()

    if (!base64Image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      )
    }

    const apiKey = process.env.VENICE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "Venice API key not configured" },
        { status: 500 }
      )
    }

    const response = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: base64Image },
              },
              {
                type: "text",
                text: 'Extract the total amount from this receipt. Return ONLY a JSON object: {"amount": number, "merchant": string, "date": "YYYY-MM-DD"}. If no clear total, return {"amount": 0, "merchant": "", "date": ""}',
              },
            ],
          },
        ],
        max_tokens: 150,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Venice API error:", errorText)
      return NextResponse.json(
        { error: "Venice API request failed" },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: "No response from Venice AI" },
        { status: 500 }
      )
    }

    // Parse the JSON response from Venice
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json(
        { amount: 0, merchant: "", date: "" }
      )
    }

    const result: VeniceScanResult = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch (error) {
    console.error("Scan receipt error:", error)
    return NextResponse.json(
      { error: "Failed to process receipt" },
      { status: 500 }
    )
  }
}
