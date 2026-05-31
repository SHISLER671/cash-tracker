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
  const percentage = Math.min((spent / budget) * 100, 100);
  const remaining = budget - spent;

  return (
    <div className="card-luxe space-y-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold text-foreground">{label}</span>
        <span className="text-lg font-medium text-foreground">
          <span className={`font-bold ${getTextColor(percentage)}`}>${spent.toFixed(0)}</span>
          <span className="text-muted-foreground"> / ${budget.toFixed(0)}</span>
        </span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{percentage.toFixed(0)}% used</span>
        <span>${remaining >= 0 ? remaining.toFixed(0) : 0} left</span>
      </div>
    </div>
  );
}
