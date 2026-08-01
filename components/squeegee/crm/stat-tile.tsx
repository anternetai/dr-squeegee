import { cn } from "@/lib/utils"

/* Tile anatomy borrowed from Midday (docs/ui-references.md #2):
   label → big numeral → inline qualifier. No icon, no sparkline, no card
   shadow. The number is the content; everything else is a caption. */
export function StatTile({
  label,
  value,
  qualifier,
  tone = "neutral",
  className,
}: {
  label: string
  value: string | number
  qualifier?: string
  tone?: "neutral" | "accent" | "attention" | "dead"
  className?: string
}) {
  const toneColor = {
    neutral: "text-[var(--crm-text)]",
    accent: "text-[var(--crm-accent)]",
    attention: "text-[var(--crm-attention)]",
    dead: "text-[var(--crm-dead)]",
  }[tone]

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface)] px-4 py-3.5",
        className
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--crm-text-faint)]">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={cn("crm-numeral text-2xl leading-none", toneColor)}>{value}</span>
        {qualifier && (
          <span className="text-xs text-[var(--crm-text-dim)]">{qualifier}</span>
        )}
      </div>
    </div>
  )
}

/* Stripe's count-tabs (docs/ui-references.md #3): one control that both counts
   and filters. Replaces a row of five differently-coloured status badges —
   only the selected segment takes the accent. */
export function CountTabs({
  items,
  className,
}: {
  items: { label: string; count: number; href: string; active?: boolean }[]
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className={cn(
            "min-w-[104px] flex-1 rounded-xl border px-3.5 py-2.5 transition-colors",
            item.active
              ? "border-[var(--crm-accent-line)] bg-[var(--crm-accent-weak)]"
              : "border-[var(--crm-line)] bg-[var(--crm-surface)] hover:border-[var(--crm-accent-line)]"
          )}
        >
          <div
            className={cn(
              "text-xs font-medium",
              item.active ? "text-[var(--crm-accent)]" : "text-[var(--crm-text-faint)]"
            )}
          >
            {item.label}
          </div>
          <div
            className={cn(
              "crm-numeral mt-1 text-xl leading-none",
              item.active ? "text-[var(--crm-accent)]" : "text-[var(--crm-text)]"
            )}
          >
            {item.count}
          </div>
        </a>
      ))}
    </div>
  )
}
