"use client"

import { useEffect } from "react"

/**
 * Recovers from stale-chunk failures.
 *
 * When a new version of the app is deployed, the JS bundle is split into chunks
 * whose filenames contain a content hash. A browser tab that was opened against
 * an OLDER build still references the old chunk URLs; the moment it tries to
 * lazy-load one of those (on navigation or a dynamic import) the file is gone
 * and the browser throws a `ChunkLoadError`. The dev server's HMR recompiles
 * cause the same symptom locally.
 *
 * The fix is to detect that specific error and force a single full reload, which
 * re-downloads the current chunk manifest. A sessionStorage flag prevents an
 * infinite reload loop if the reload itself somehow fails.
 */
const RELOAD_FLAG = "chunk-reload-attempted"

function isChunkLoadError(value: unknown): boolean {
  if (!value) return false
  const name = (value as { name?: string }).name
  const message = (value as { message?: string }).message ?? String(value)
  return (
    name === "ChunkLoadError" ||
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /Failed to load chunk/i.test(message) ||
    /Loading CSS chunk/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  )
}

function reloadOnce() {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return
    sessionStorage.setItem(RELOAD_FLAG, "1")
  } catch {
    // sessionStorage unavailable (private mode / SSR) — fall through and reload.
  }
  console.log("[v0] ChunkLoadError detected — reloading to fetch the latest build")
  window.location.reload()
}

export function ChunkErrorReloader() {
  useEffect(() => {
    // A successful load means we're on a fresh build; clear the guard so future
    // deploys can trigger a reload again.
    try {
      sessionStorage.removeItem(RELOAD_FLAG)
    } catch {
      // ignore
    }

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        reloadOnce()
      }
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        reloadOnce()
      }
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [])

  return null
}
