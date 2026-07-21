"use client"

// Shared "smart" quote line builder — used by the one single New Quote flow
// (components/squeegee/quick-quote-flow.tsx, at /crm/quotes/new). Kills manual
// typing for window counts / driveway sqft — auto-computes a price from
// lib/squeegee/pricing.ts, always editable. Windows are one combined block
// with counts per story (1st/2nd/3rd), not separate per-story line items.
import { Input } from "@/components/ui/input"
import { Plus, X } from "lucide-react"
import {
  Story,
  Coverage,
  STORY_SHORT_LABEL,
  WindowCounts,
  computeWindowPriceMulti,
  windowDetailMulti,
  SQFT_SERVICE_DEFAULTS,
  SqftServiceName,
  computeSqftPrice,
  sqftDetail,
  HOUSE_WASH_TIERS,
  HouseWashTierKey,
  houseWashTier,
} from "@/lib/squeegee/pricing"

export type LineKind = "window" | "sqft" | "housewash" | "roof" | "custom"

export interface QuoteLine {
  key: string
  kind: LineKind
  name: string
  price: number
  detail?: string
  /** true once the owner has typed directly into the price field — stops auto-recompute until an underlying input changes again. */
  manualPrice?: boolean
  // window — one combined block, counts per story
  windowCounts?: WindowCounts
  coverage?: Coverage
  // sqft
  sqftServiceName?: SqftServiceName
  sqft?: number
  rate?: number
  // housewash
  houseTier?: HouseWashTierKey
}

let _lineSeq = 0
export function newLineKey(): string {
  return `ql-${Date.now()}-${_lineSeq++}`
}

function recompute(line: QuoteLine): QuoteLine {
  if (line.manualPrice) return line
  if (line.kind === "window") {
    const counts = line.windowCounts ?? {}
    const coverage = line.coverage ?? "exterior"
    const total = ([1, 2, 3] as Story[]).reduce((sum, s) => sum + (counts[s] ?? 0), 0)
    return {
      ...line,
      price: computeWindowPriceMulti(counts, coverage),
      detail: total > 0 ? windowDetailMulti(counts, coverage) : undefined,
    }
  }
  if (line.kind === "sqft") {
    const sqft = line.sqft ?? 0
    const rate = line.rate ?? 0
    return {
      ...line,
      price: computeSqftPrice(sqft, rate),
      detail: sqft > 0 ? sqftDetail(sqft, rate) : undefined,
    }
  }
  if (line.kind === "housewash") {
    const tier = houseWashTier(line.houseTier ?? HOUSE_WASH_TIERS[0].key)
    return { ...line, price: tier.price, detail: tier.label }
  }
  return line
}

export function makeLine(kind: LineKind, sqftName?: SqftServiceName): QuoteLine {
  const key = newLineKey()
  if (kind === "window") {
    return recompute({ key, kind, name: "Window Cleaning", price: 0, windowCounts: {}, coverage: "exterior" })
  }
  if (kind === "sqft") {
    const name = sqftName ?? "Driveway"
    return recompute({ key, kind, name, price: 0, sqftServiceName: name, sqft: 0, rate: SQFT_SERVICE_DEFAULTS[name] })
  }
  if (kind === "housewash") {
    return recompute({
      key,
      kind,
      name: "House Washing",
      price: HOUSE_WASH_TIERS[0].price,
      houseTier: HOUSE_WASH_TIERS[0].key,
    })
  }
  if (kind === "roof") {
    return { key, kind, name: "Roof + Gutter Cleaning", price: 0, manualPrice: true }
  }
  return { key, kind: "custom", name: "", price: 0, manualPrice: true }
}

/** Converts builder lines into the `services` jsonb shape stored on squeegee_quotes. */
export function linesToServices(lines: QuoteLine[]): { name: string; price: number; detail?: string }[] {
  return lines
    .filter((l) => l.name.trim().length > 0 && l.price > 0)
    .map((l) => ({
      name: l.name.trim(),
      price: l.price,
      ...(l.detail ? { detail: l.detail } : {}),
    }))
}

const ADD_BUTTONS: { label: string; kind: LineKind; sqftName?: SqftServiceName }[] = [
  { label: "Window Cleaning", kind: "window" },
  { label: "House Washing", kind: "housewash" },
  { label: "Driveway", kind: "sqft", sqftName: "Driveway" },
  { label: "Surface Cleaning", kind: "sqft", sqftName: "Surface Cleaning" },
  { label: "Pool Deck", kind: "sqft", sqftName: "Pool Deck" },
  { label: "Pavers", kind: "sqft", sqftName: "Pavers" },
  { label: "Roof + Gutter", kind: "roof" },
  { label: "Custom", kind: "custom" },
]

interface Props {
  lines: QuoteLine[]
  onChange: (lines: QuoteLine[]) => void
}

export function SmartQuoteLines({ lines, onChange }: Props) {
  function addLine(kind: LineKind, sqftName?: SqftServiceName) {
    onChange([...lines, makeLine(kind, sqftName)])
  }

  function updateLine(key: string, patch: Partial<QuoteLine>) {
    onChange(lines.map((l) => (l.key === key ? recompute({ ...l, ...patch }) : l)))
  }

  function setManualPrice(key: string, priceStr: string) {
    const price = parseFloat(priceStr) || 0
    onChange(lines.map((l) => (l.key === key ? { ...l, price, manualPrice: true } : l)))
  }

  function removeLine(key: string) {
    onChange(lines.filter((l) => l.key !== key))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {ADD_BUTTONS.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() => addLine(b.kind, b.sqftName)}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted transition-colors"
          >
            <Plus className="h-3 w-3" />
            {b.label}
          </button>
        ))}
      </div>

      {lines.length === 0 && (
        <p className="text-sm text-muted-foreground">No service lines yet — add one above.</p>
      )}

      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.key} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              {line.kind === "custom" ? (
                <input
                  type="text"
                  placeholder="Service name"
                  value={line.name}
                  onChange={(e) => updateLine(line.key, { name: e.target.value })}
                  className="flex-1 h-8 rounded border border-input bg-background px-2 text-sm font-medium"
                  autoFocus
                />
              ) : (
                <p className="text-sm font-medium">{line.name}</p>
              )}
              <button
                type="button"
                onClick={() => removeLine(line.key)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors shrink-0"
                title="Remove line"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {line.kind === "window" && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  {([1, 2, 3] as Story[]).map((s) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{STORY_SHORT_LABEL[s]} floor</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={line.windowCounts?.[s] || ""}
                        placeholder="0"
                        onChange={(e) =>
                          updateLine(line.key, {
                            windowCounts: {
                              ...line.windowCounts,
                              [s]: parseInt(e.target.value, 10) || 0,
                            },
                            manualPrice: false,
                          })
                        }
                        className="h-8 w-16 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Coverage</span>
                  <select
                    value={line.coverage ?? "exterior"}
                    onChange={(e) =>
                      updateLine(line.key, { coverage: e.target.value as Coverage, manualPrice: false })
                    }
                    className="h-8 rounded border border-input bg-background px-2 text-sm"
                  >
                    <option value="exterior">Exterior only</option>
                    <option value="both">In &amp; out</option>
                  </select>
                </div>
              </div>
            )}

            {line.kind === "sqft" && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Sqft</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={line.sqft || ""}
                    placeholder="0"
                    onChange={(e) =>
                      updateLine(line.key, { sqft: parseFloat(e.target.value) || 0, manualPrice: false })
                    }
                    className="h-8 w-24 text-sm"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">$ / sqft</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={line.rate || ""}
                    placeholder="0"
                    onChange={(e) =>
                      updateLine(line.key, { rate: parseFloat(e.target.value) || 0, manualPrice: false })
                    }
                    className="h-8 w-24 text-sm"
                  />
                </div>
              </div>
            )}

            {line.kind === "housewash" && (
              <select
                value={line.houseTier ?? HOUSE_WASH_TIERS[0].key}
                onChange={(e) =>
                  updateLine(line.key, { houseTier: e.target.value as HouseWashTierKey, manualPrice: false })
                }
                className="h-8 w-full rounded border border-input bg-background px-2 text-sm"
              >
                {HOUSE_WASH_TIERS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label} — ${t.price}
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
              {line.detail ? (
                <p className="text-xs text-muted-foreground">{line.detail}</p>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={line.price || ""}
                  placeholder="0"
                  onChange={(e) => setManualPrice(line.key, e.target.value)}
                  className="h-8 w-24 text-sm font-semibold text-right"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
