"use client";

interface CashDisplayProps {
  amount: number;
}

export function CashDisplay({ amount }: CashDisplayProps) {
  const isPositive = amount >= 0;
  
  return (
    <div className="card-luxe my-6 flex flex-col items-center gap-3 px-8 py-12">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Cash on Hand
      </span>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold ${isPositive ? 'text-income' : 'text-expense'}`}>$</span>
        <span className={`text-6xl font-bold tabular-nums tracking-tight sm:text-7xl ${isPositive ? 'text-income' : 'text-expense'}`}>
          {Math.abs(amount).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
    </div>
  );
}
