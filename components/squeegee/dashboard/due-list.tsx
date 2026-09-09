import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Section, List, Empty } from "./section"
import { money } from "@/lib/crm/status"
import type { Offer } from "@/lib/squeegee/offers"

/* The top of the offer engine, on the home screen: who to call today and
   what to offer. The full ranked list lives on /crm/clients. */

export interface DueRow {
  clientId: string
  clientName: string
  offer: Offer
}

const KIND_LABEL: Record<Offer["kind"], string> = {
  due: "Due",
  never_had: "Cross-sell",
  plan: "Care Club",
  seasonal: "In season",
}

export function DueList({ rows, dueCount }: { rows: DueRow[]; dueCount: number }) {
  return (
    <Section
      id="due"
      icon={Sparkles}
      title="Due for service"
      aside={dueCount > 0 ? `${dueCount} due now` : undefined}
      tone="accent"
      href="/crm/clients?filter=due"
      hrefLabel="See all"
    >
      {rows.length === 0 ? (
        <Empty>No one is due right now.</Empty>
      ) : (
        <List>
          {rows.map(({ clientId, clientName, offer }) => (
            <Link
              key={`${clientId}-${offer.kind}-${offer.service ?? "plan"}`}
              href={`/crm/clients/${clientId}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--crm-surface-high)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{clientName}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      offer.kind === "due" && (offer.overdueDays ?? 0) >= 0
                        ? "bg-[var(--crm-attention-bg)] text-[var(--crm-attention)]"
                        : "bg-[var(--crm-idle-bg)] text-[var(--crm-idle)]"
                    }`}
                  >
                    {KIND_LABEL[offer.kind]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[var(--crm-text-faint)]">
                  {offer.label} · {offer.reason}
                </p>
              </div>
              {offer.suggestedPrice != null && (
                <span className="crm-numeral shrink-0 text-sm text-[var(--crm-text-dim)]">~{money(offer.suggestedPrice)}</span>
              )}
            </Link>
          ))}
        </List>
      )}
    </Section>
  )
}
