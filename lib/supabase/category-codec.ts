/**
 * Legacy Supabase installs enforce category IN (gas, food, medical, other).
 * Encode custom labels in note until migration 002 drops the check constraint.
 */
const LEGACY_ALLOWED = new Set(["gas", "food", "medical", "other"])
const CATEGORY_TAG = "Category: "

export function prepareCategoryForPush(
  category: string | undefined,
  note: string | undefined,
): { category: string; note: string | null } {
  const raw = (category ?? "").trim()
  const normalized = raw.toLowerCase() || "other"

  if (LEGACY_ALLOWED.has(normalized)) {
    return { category: normalized, note: note?.trim() || null }
  }

  const label = raw || "other"
  const parts = [note?.trim(), `${CATEGORY_TAG}${label}`].filter(Boolean)
  return { category: "other", note: parts.join(" · ") || null }
}

export function parseCategoryFromPull(
  category: string,
  note: string | null | undefined,
): { category: string; note?: string } {
  const n = note?.trim() || ""
  const tagIndex = n.indexOf(CATEGORY_TAG)
  if (tagIndex === -1) {
    return { category: category || "other", note: n || undefined }
  }

  const afterTag = n.slice(tagIndex + CATEGORY_TAG.length)
  const customEnd = afterTag.indexOf(" · ")
  const customCat = (customEnd === -1 ? afterTag : afterTag.slice(0, customEnd)).trim()

  const before = n.slice(0, tagIndex).replace(/ · $/, "").trim()
  const after =
    customEnd === -1 ? "" : afterTag.slice(customEnd + 3).trim()
  const restNote = [before, after].filter(Boolean).join(" · ").trim()

  return {
    category: customCat || category || "other",
    note: restNote || undefined,
  }
}