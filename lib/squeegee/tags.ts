// Client tags. A suggested vocabulary the UI offers first, plus free tags
// shaped by normalizeTag. The vocabulary is suggested, not enforced: Anthony
// will need "palisades" or "hoa-board" the day he needs it, and forcing him
// into notes instead would lose the filter.
//
// Import-free so node:test can load it under --experimental-strip-types.

export const SUGGESTED_TAGS = [
  "vip",
  "care-club",
  "commercial",
  "hoa",
  "realtor",
  "referral-source",
  "price-sensitive",
  "gate-code",
  "dog-on-site",
  "slow-pay",
  "do-not-text",
  "do-not-upsell",
] as const

export type SuggestedTag = (typeof SUGGESTED_TAGS)[number]

/** Tags with behaviour attached, so the UI can explain them. */
export const TAG_HINTS: Partial<Record<SuggestedTag, string>> = {
  "do-not-text": "Bulk texts and automatic rebooks skip this client",
  "do-not-upsell": "No offers shown for this client",
  "care-club": "Suggested automatically for signed plan members",
  "slow-pay": "Follow up on invoices sooner",
}

export const MAX_TAGS = 12
export const MIN_TAG_LENGTH = 2
export const MAX_TAG_LENGTH = 24

/** "VIP Client!" -> "vip-client"; returns null when nothing usable is left. */
export function normalizeTag(raw: string | null | undefined): string | null {
  const t = (raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
  if (t.length < MIN_TAG_LENGTH || t.length > MAX_TAG_LENGTH) return null
  return t
}

/** Add tags: normalize, dedupe, keep existing order, cap at MAX_TAGS. */
export function mergeTags(existing: readonly string[], add: readonly string[]): string[] {
  const out: string[] = []
  for (const t of [...existing, ...add]) {
    const n = normalizeTag(t)
    if (n && !out.includes(n)) out.push(n)
    if (out.length >= MAX_TAGS) break
  }
  return out
}

export function removeTags(existing: readonly string[], drop: readonly string[]): string[] {
  const gone = new Set(drop.map((t) => normalizeTag(t)).filter(Boolean))
  return existing.filter((t) => !gone.has(normalizeTag(t)))
}

export function hasTag(tags: readonly string[] | null | undefined, tag: string): boolean {
  const n = normalizeTag(tag)
  return !!n && !!tags && tags.some((t) => normalizeTag(t) === n)
}
