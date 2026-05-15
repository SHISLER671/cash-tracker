export type Category = "gas" | "food" | "medical" | "other"

export type TransactionType = "in" | "out"

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  category: Category
  date: Date
  note?: string
}

export const categoryIcons: Record<Category, string> = {
  gas: "⛽",
  food: "🍔",
  medical: "💊",
  other: "📦",
}

export const categoryLabels: Record<Category, string> = {
  gas: "Gas",
  food: "Food",
  medical: "Medical",
  other: "Other",
}
