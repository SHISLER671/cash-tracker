/** Row shape for public.shared_transactions (Supabase). */
export interface SharedTransactionRow {
  id: string
  date: string
  amount: number
  merchant: string | null
  category: string
  type: "in" | "out"
  note: string | null
  account_id: number | null
  device_id: string | null
  deleted: boolean
  updated_at: string
}