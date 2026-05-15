interface ExtractedAmount {
  label: string
  amount: number
}

interface ExtractedAmountsProps {
  amounts: ExtractedAmount[]
  onConfirm: () => void
  onRetry: () => void
}

export function ExtractedAmounts({ amounts, onConfirm, onRetry }: ExtractedAmountsProps) {
  const total = amounts.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="flex-1 bg-zinc-900 p-6 flex flex-col">
      <h2 className="text-xl font-semibold text-white mb-6">Extracted Amounts</h2>

      <div className="flex-1 space-y-3">
        {amounts.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between py-3 px-4 bg-zinc-800 rounded-lg"
          >
            <span className="text-zinc-300">{item.label}</span>
            <span className="text-white font-mono text-lg">
              ${item.amount.toFixed(2)}
            </span>
          </div>
        ))}

        <div className="border-t border-zinc-700 pt-4 mt-4">
          <div className="flex items-center justify-between py-3 px-4 bg-zinc-800 rounded-lg">
            <span className="text-white font-semibold">Total</span>
            <span className="text-emerald-400 font-mono text-xl font-bold">
              ${total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onRetry}
          className="flex-1 py-4 px-6 bg-zinc-800 text-white rounded-xl font-medium active:bg-zinc-700 transition-colors"
        >
          Retake
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-4 px-6 bg-emerald-600 text-white rounded-xl font-medium active:bg-emerald-700 transition-colors"
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
