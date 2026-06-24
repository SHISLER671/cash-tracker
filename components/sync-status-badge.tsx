"use client"

import { Loader2, RefreshCw, CloudOff, Check, AlertCircle } from "lucide-react"
import { useSyncStatus } from "@/components/sync-provider"
import { cn } from "@/lib/utils"

export function SyncStatusBadge({ className }: { className?: string }) {
  const { state, pendingCount, retry } = useSyncStatus()

  const config = {
    offline: {
      icon: CloudOff,
      label: "Offline",
      className: "text-muted-foreground",
    },
    idle: {
      icon: RefreshCw,
      label: "Ready",
      className: "text-muted-foreground",
    },
    syncing: {
      icon: Loader2,
      label: "Syncing…",
      className: "text-primary",
      spin: true,
    },
    synced: {
      icon: Check,
      label: "Synced",
      className: "text-income",
    },
    error: {
      icon: AlertCircle,
      label: "Sync failed",
      className: "text-expense",
    },
  } as const

  const current = config[state]
  const Icon = current.icon
  const label =
    pendingCount > 0 && state !== "syncing"
      ? `${pendingCount} pending`
      : current.label

  if (state === "offline") return null

  return (
    <button
      type="button"
      onClick={retry}
      className={cn(
        "flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium shadow-earth transition-all hover:bg-secondary active:scale-95",
        current.className,
        className,
      )}
      aria-label={`Sync status: ${label}. Tap to sync now.`}
    >
      <Icon className={cn("h-3.5 w-3.5", "spin" in current && current.spin && "animate-spin")} />
      <span>{label}</span>
    </button>
  )
}