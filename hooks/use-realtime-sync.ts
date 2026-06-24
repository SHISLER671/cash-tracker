"use client"

import { useEffect, useRef } from "react"
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client"
import { pullFromPartner } from "@/lib/supabase/sync"
import { getDeviceId } from "@/lib/db"

/** Subscribe to shared_transactions changes and debounce-pull into Dexie. */
export function useRealtimeSync() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    const channel = supabase
      .channel("shared_transactions_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shared_transactions" },
        (payload) => {
          const row = payload.new as { device_id?: string } | null
          const oldRow = payload.old as { device_id?: string } | null
          const deviceId = row?.device_id ?? oldRow?.device_id
          // Skip self-echo when we already pushed; pull still runs for other devices.
          if (deviceId && deviceId === getDeviceId()) return

          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            void pullFromPartner().catch((e) =>
              console.error("[v0][sync] realtime pull failed:", e),
            )
          }, 300)
        },
      )
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      void supabase.removeChannel(channel)
    }
  }, [])
}