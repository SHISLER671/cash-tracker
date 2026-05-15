"use client";

interface CashDisplayProps {
  amount: number;
}

export function CashDisplay({ amount }: CashDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-8">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Cash on Hand
      </span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-emerald-500">$</span>
        <span className="text-6xl font-bold tabular-nums tracking-tight text-emerald-500 sm:text-7xl">
          {amount.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
    </div>
  );
}
