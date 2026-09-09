import Link from "next/link"
import { CircleDollarSign } from "lucide-react"
import { Section, List, Empty } from "./section"
import { money } from "@/lib/crm/status"
import { shortDateET } from "@/lib/squeegee/dates"
import type { CloseoutItem } from "@/lib/squeegee/metrics"

/* Work that is done but not counted as money yet. This is the section that
   turns finished jobs into revenue, so it sits above everything that is still
   future money. Each row hands off to the job page's Done & Paid sheet. */

export function CloseoutTray({ items, total }: { items: CloseoutItem[]; total: number }) {
  const shown = items.slice(0, 8)
  return (
    <Section
      id="closeout"
      icon={CircleDollarSign}
      title="Done, not closed out"
      tone="attention"
      aside={items.length > 0 ? `${money(total)} in ${items.length} ${items.length === 1 ? "job" : "jobs"}` : undefined}
      href={items.length > shown.length ? "/crm/reconcile" : undefined}
      hrefLabel="All"
    >
      {items.length === 0 ? (
        <Empty>Every finished job is paid and recorded.</Empty>
      ) : (
        <List>
          {shown.map((it) => (
            <div key={it.jobId} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/crm/jobs/${it.jobId}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{it.clientName}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--crm-text-faint)]">
                  {it.serviceType ?? "Service"} ·{" "}
                  {it.reason === "appointment_passed" ? `was scheduled ${shortDateET(it.doneOn)} - did it happen?` : `done ${shortDateET(it.doneOn)}`}
                </p>
              </Link>
              {it.amount != null && <span className="crm-numeral shrink-0 text-sm">{money(it.amount)}</span>}
              <Link
                href={`/crm/jobs/${it.jobId}?closeout=1`}
                className="shrink-0 rounded-lg bg-[var(--crm-accent)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--crm-accent-hover)]"
              >
                Done &amp; paid
              </Link>
            </div>
          ))}
        </List>
      )}
    </Section>
  )
}
