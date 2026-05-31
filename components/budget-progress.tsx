"use client";

interface BudgetProgressProps {
  label: string;
  spent: number;
  budget: number;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 90) return "bg-expense";
  if (percentage >= 75) return "bg-warning";
  return "bg-income";
}

function getTextColor(percentage: number): string {
  if (percentage >= 90) return "text-expense";
  if (percentage >= 75) return "text-warning";
  return "text-income";
}

export function BudgetProgress({ label, spent, budget }: BudgetProgressProps) {
  const rawPercentage = budget > 0 ? (spent / budget) * 100 : 0;
  const barWidth = Math.min(rawPercentage, 100);
  const remaining = budget - spent;
  const isOver = remaining < 0;

  return (
    <div className="card-luxe space-y-3 p-6">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold text-foreground">{label}</span>
        <span className="text-lg font-medium">
          <span className={`font-bold ${getTextColor(rawPercentage)}`}>${spent.toFixed(0)}</span>
          <span className="text-muted-foreground"> / ${budget.toFixed(0)}</span>
        </span>
      </div>
      <div className="h-5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor(rawPercentage)}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{rawPercentage.toFixed(0)}% used</span>
        {isOver ? (
          <span className="font-semibold text-expense">${Math.abs(remaining).toFixed(0)} over</span>
        ) : (
          <span className="font-medium text-foreground">${remaining.toFixed(0)} left</span>
        )}
      </div>
    </div>
  );
}
