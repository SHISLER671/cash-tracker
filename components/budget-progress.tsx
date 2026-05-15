"use client";

interface BudgetProgressProps {
  label: string;
  spent: number;
  budget: number;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 75) return "bg-yellow-500";
  return "bg-emerald-500";
}

function getTextColor(percentage: number): string {
  if (percentage >= 90) return "text-red-500";
  if (percentage >= 75) return "text-yellow-500";
  return "text-emerald-500";
}

export function BudgetProgress({ label, spent, budget }: BudgetProgressProps) {
  const percentage = Math.min((spent / budget) * 100, 100);
  const remaining = budget - spent;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className={`text-sm font-semibold ${getTextColor(percentage)}`}>
          ${spent.toFixed(0)} / ${budget.toFixed(0)}
        </span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all duration-500 ease-out ${getProgressColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{percentage.toFixed(0)}% used</span>
        <span>${remaining >= 0 ? remaining.toFixed(0) : 0} remaining</span>
      </div>
    </div>
  );
}
