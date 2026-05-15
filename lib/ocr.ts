export interface ScanResult {
  amount: number
  merchant: string
  date: string
}

export const scanReceipt = async (imageData: string): Promise<ScanResult> => {
  const response = await fetch("/api/scan-receipt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ base64Image: imageData }),
  })

  if (!response.ok) {
    throw new Error("Failed to scan receipt")
  }

  const result = await response.json()
  
  return {
    amount: result.amount || 0,
    merchant: result.merchant || "",
    date: result.date || "",
  }
}
