"use client";

import { Plus } from "lucide-react";

interface AddButtonProps {
  onClick?: () => void;
}

export function AddButton({ onClick }: AddButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-all hover:bg-emerald-600 hover:shadow-xl active:scale-95"
      aria-label="Add transaction"
    >
      <Plus className="h-8 w-8" strokeWidth={2.5} />
    </button>
  );
}
