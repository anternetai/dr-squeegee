import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/* One section grammar for the dashboard: a quiet uppercase label, an optional
   right-hand figure (the money, the count), and a bordered list beneath. The
   old page mixed three card styles; this is the only one now. */

export function Section({
  id,
  icon: Icon,
  title,
  aside,
  href,
  hrefLabel = "View all",
  tone = "neutral",
  children,
  className,
}: {
  id?: string
  icon?: LucideIcon
  title: string
  aside?: React.ReactNode
  href?: string
  hrefLabel?: string
  tone?: "neutral" | "attention" | "accent"
  children: React.ReactNode
  className?: string
}) {
  const asideColor = {
    neutral: "text-[var(--crm-text-dim)]",
    attention: "text-[var(--crm-attention)]",
    accent: "text-[var(--crm-accent)]",
  }[tone]
  return (
    <section id={id} className={cn("scroll-mt-20", className)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--crm-text-faint)]">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {title}
        </h3>
        <div className="flex items-center gap-3">
          {aside && <span className={cn("crm-numeral text-sm", asideColor)}>{aside}</span>}
          {href && (
            <Link href={href} className="text-xs text-[var(--crm-accent)] hover:underline">
              {hrefLabel}
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

export function List({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "divide-y divide-[var(--crm-line)] overflow-hidden rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface)]",
        className
      )}
    >
      {children}
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--crm-line)] px-4 py-5 text-center text-sm text-[var(--crm-text-dim)]">
      {children}
    </div>
  )
}

/** Days-old pill: neutral under 3 days, attention from 3, dead from 7. */
export function AgePill({ days }: { days: number }) {
  const cls =
    days >= 7
      ? "bg-[var(--crm-dead-bg)] text-[var(--crm-dead)]"
      : days >= 3
        ? "bg-[var(--crm-attention-bg)] text-[var(--crm-attention)]"
        : "bg-[var(--crm-idle-bg)] text-[var(--crm-idle)]"
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", cls)}>{days}d</span>
}
