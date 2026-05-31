"use client"

import { useEffect, useRef, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import {
  Fuel,
  UtensilsCrossed,
  Pill,
  ShoppingCart,
  Package,
  Plus,
  Tag,
  ChevronUp,
  ChevronDown,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  addPresetIfNew,
  deletePreset,
  getOrderedPresets,
  renamePreset,
  reorderPresets,
  seedDefaultPresets,
  type Preset,
} from "@/lib/db"

interface CategoryButtonsProps {
  value: string | null
  onChange: (value: string) => void
}

// Default categories seeded into the presets table on first load.
const DEFAULT_CATEGORIES = ["gas", "food", "medical", "groceries", "other"]

const ICONS: Record<string, LucideIcon> = {
  gas: Fuel,
  food: UtensilsCrossed,
  medical: Pill,
  groceries: ShoppingCart,
  other: Package,
}

function iconFor(name: string): LucideIcon {
  return ICONS[name.toLowerCase()] ?? Tag
}

const LONG_PRESS_MS = 600
const MOVE_THRESHOLD = 10

export function CategoryButtons({ value, onChange }: CategoryButtonsProps) {
  // Single source of truth: ordered presets (defaults are seeded in).
  const categories = useLiveQuery(() => getOrderedPresets(), []) ?? []

  // Ensure defaults exist + every preset has an order. Idempotent.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    seedDefaultPresets(DEFAULT_CATEGORIES)
  }, [])

  // ----- Long-press handling -----
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const [pressingId, setPressingId] = useState<number | null>(null)

  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    startPos.current = null
    setPressingId(null)
  }

  const handlePointerDown = (e: React.PointerEvent, preset: Preset) => {
    longPressFired.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    setPressingId(preset.id ?? null)
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true
      setPressingId(null)
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40)
      openEditor(preset)
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPos.current) return
    const dx = Math.abs(e.clientX - startPos.current.x)
    const dy = Math.abs(e.clientY - startPos.current.y)
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) clearPress()
  }

  const endPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    startPos.current = null
    setPressingId(null)
  }

  // Tap (quick add). Skipped if a long-press just opened the editor — keyboard
  // activation still works because longPressFired is only set by the timer.
  const handleClick = (preset: Preset) => {
    if (longPressFired.current) {
      longPressFired.current = false
      return
    }
    onChange(preset.name.toLowerCase())
  }

  // ----- Editor state -----
  const [editingId, setEditingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editing = categories.find((c) => c.id === editingId) ?? null
  const editingIndex = editing ? categories.findIndex((c) => c.id === editing.id) : -1

  const openEditor = (preset: Preset) => {
    setEditingId(preset.id ?? null)
    setRenameValue(preset.name)
    setConfirmDelete(false)
    setError(null)
  }

  const closeEditor = () => {
    setEditingId(null)
    setConfirmDelete(false)
    setError(null)
  }

  const handleRename = async () => {
    if (editingId == null) return
    if (renameValue.trim().toLowerCase() === editing?.name.toLowerCase()) {
      closeEditor()
      return
    }
    const res = await renamePreset(editingId, renameValue)
    if (!res.ok) {
      setError(res.reason === "duplicate" ? "That name already exists" : "Name can't be empty")
      return
    }
    closeEditor()
  }

  const move = async (dir: -1 | 1) => {
    if (editingIndex < 0) return
    const target = editingIndex + dir
    if (target < 0 || target >= categories.length) return
    const ids = categories.map((c) => c.id!) as number[]
    ;[ids[editingIndex], ids[target]] = [ids[target], ids[editingIndex]]
    await reorderPresets(ids)
    // editing follows the same preset; index recomputes from the live query.
  }

  const handleDelete = async () => {
    if (editingId == null) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await deletePreset(editingId)
    closeEditor()
  }

  const handleAddCategory = async () => {
    const name = window.prompt("New category name?")?.trim()
    if (!name) return
    await addPresetIfNew(name)
    onChange(name.toLowerCase())
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-3 w-full max-w-md mx-auto sm:grid-cols-4">
        {categories.map((category) => {
          const Icon = iconFor(category.name)
          const isSelected = value?.toLowerCase() === category.name.toLowerCase()
          const isPressing = pressingId === category.id
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => handleClick(category)}
              onPointerDown={(e) => handlePointerDown(e, category)}
              onPointerMove={handlePointerMove}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onPointerCancel={endPress}
              onContextMenu={(e) => e.preventDefault()}
              style={{ touchAction: "manipulation" }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-4 rounded-3xl transition-all duration-200 select-none",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-earth ring-2 ring-primary"
                  : "bg-card text-foreground hover:bg-secondary",
                isPressing && "scale-95 ring-2 ring-gold-dark/60 brightness-95",
              )}
            >
              <Icon className="h-7 w-7" />
              <span className="text-xs font-bold uppercase tracking-wide truncate max-w-full">
                {category.name}
              </span>
            </button>
          )
        })}

        <button
          type="button"
          onClick={handleAddCategory}
          className="flex flex-col items-center justify-center gap-2 p-4 rounded-3xl border border-dashed border-muted-foreground/40 text-muted-foreground transition-all duration-200 hover:bg-secondary active:scale-95"
        >
          <Plus className="h-7 w-7" />
          <span className="text-xs font-bold uppercase tracking-wide">New</span>
        </button>
      </div>

      {/* Hint */}
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Tap to choose &middot; hold to edit
      </p>

      {/* Edit sheet */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            aria-label="Close editor"
            onClick={closeEditor}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in"
          />

          <div className="relative w-full max-w-md bg-popover rounded-t-3xl shadow-luxe p-6 pb-8 animate-in slide-in-from-bottom duration-200">
            {/* Drag handle */}
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-border-luxe" />

            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-gold-dark">
                  {(() => {
                    const Icon = iconFor(editing.name)
                    return <Icon className="h-6 w-6" />
                  })()}
                </div>
                <h2 className="text-xl font-semibold text-foreground">Edit Category</h2>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Rename */}
            <label className="mb-2 block text-sm font-medium text-muted-foreground">Name</label>
            <div className="flex gap-3">
              <input
                value={renameValue}
                onChange={(e) => {
                  setRenameValue(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename()
                }}
                autoFocus
                className="flex-1 rounded-2xl border border-border-luxe bg-card px-4 py-4 text-lg text-foreground outline-none focus:ring-2 focus:ring-primary"
                placeholder="Category name"
              />
              <button
                type="button"
                onClick={handleRename}
                className="rounded-2xl bg-gradient-to-br from-gold-light to-gold-dark px-6 py-4 text-base font-semibold text-primary-foreground shadow-earth active:scale-95 transition-all"
              >
                Save
              </button>
            </div>
            {error && <p className="mt-2 text-sm font-medium text-expense">{error}</p>}

            {/* Reorder */}
            <label className="mb-2 mt-6 block text-sm font-medium text-muted-foreground">
              Reorder
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => move(-1)}
                disabled={editingIndex <= 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-card border border-border-luxe py-4 text-base font-semibold text-foreground active:scale-95 transition-all disabled:opacity-40"
              >
                <ChevronUp className="h-5 w-5" />
                Move Up
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                disabled={editingIndex < 0 || editingIndex >= categories.length - 1}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-card border border-border-luxe py-4 text-base font-semibold text-foreground active:scale-95 transition-all disabled:opacity-40"
              >
                <ChevronDown className="h-5 w-5" />
                Move Down
              </button>
            </div>

            {/* Delete */}
            <button
              type="button"
              onClick={handleDelete}
              className={cn(
                "mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold active:scale-95 transition-all",
                confirmDelete
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              <Trash2 className="h-5 w-5" />
              {confirmDelete ? "Tap again to confirm delete" : "Delete Category"}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
