"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import {
  autoPullIfNeeded,
  getPendingPushCount,
  scheduleSync,
  subscribeSync,
  syncNow,
  type SyncState,
} from "@/lib/supabase/sync"
import { useRealtimeSync } from "@/hooks/use-realtime-sync"

type SyncContextValue = {
  state: SyncState
  pendingCount: number
  retry: () => void
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function useSyncStatus(): SyncContextValue {
  const ctx = useContext(SyncContext)
  if (!ctx) {
    return { state: "offline", pendingCount: 0, retry: () => {} }
  }
  return ctx
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SyncState>(
    isSupabaseConfigured ? "idle" : "offline",
  )
  const [pendingCount, setPendingCount] = useState(0)
  const lastFocusSync = useRef(0)

  useRealtimeSync()

  const refreshPending = useCallback(async () => {
    if (!isSupabaseConfigured) return
    setPendingCount(await getPendingPushCount())
  }, [])

  const retry = useCallback(() => {
    if (!isSupabaseConfigured) return
    setState("syncing")
    void syncNow().finally(() => void refreshPending())
  }, [refreshPending])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    void autoPullIfNeeded().finally(() => void refreshPending())

    const unsub = subscribeSync((event) => {
      if (event.type === "start") setState("syncing")
      if (event.type === "complete") {
        setState(event.result.ok ? "synced" : "error")
        void refreshPending()
      }
      if (event.type === "error") {
        setState("error")
        void refreshPending()
      }
    })

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleSync("visibility")
        void refreshPending()
      }
    }

    const onFocus = () => {
      const now = Date.now()
      if (now - lastFocusSync.current < 5000) return
      lastFocusSync.current = now
      scheduleSync("focus")
    }

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshPending()
      }
    }, 30_000)

    const backgroundInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        scheduleSync("interval")
      }
    }, 60_000)

    return () => {
      unsub()
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
      clearInterval(interval)
      clearInterval(backgroundInterval)
    }
  }, [refreshPending])

  return (
    <SyncContext.Provider value={{ state, pendingCount, retry }}>
      {children}
    </SyncContext.Provider>
  )
}