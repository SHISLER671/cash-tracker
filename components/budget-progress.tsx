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
    <div className="space-y-2 rounded-xl bg-card p-4 shadow-earth">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className={`text-sm font-bold ${getTextColor(percentage)}`}>
          ${spent.toFixed(0)} / ${budget.toFixed(0)}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-500 ease-out ${getProgressColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{percentage.toFixed(0)}% used</span>
        <span>${remaining >= 0 ? remaining.toFixed(0) : 0} left</span>
      </div>
    </div>
  );
}
