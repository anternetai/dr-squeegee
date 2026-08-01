import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarClock } from "lucide-react"

export interface NeedsSchedulingItem {
  id: string
  clientName: string
  serviceType: string
  amount: number | null
  createdAt: string
}

function daysOut(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000))
}

function ageClasses(days: number): string {
  if (days >= 7) return "bg-[var(--crm-dead-bg)] text-[var(--crm-dead)]"
  if (days >= 3) return "bg-[var(--crm-attention-bg)] text-[var(--crm-attention)]"
  return "bg-muted text-muted-foreground"
}

// "Needs scheduling" — approved jobs with no appointment date yet. This is
// the enforcement mechanism: a job can be approved and still slip through
// the cracks if nobody books a slot. Surface it on the dashboard so it can't.
export function NeedsScheduling({ items }: { items: NeedsSchedulingItem[] }) {
  const shown = items.slice(0, 8)

  return (
    <Card className="border-[var(--crm-accent-line)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-[var(--crm-accent-weak)]">
              <CalendarClock className="h-4 w-4 text-[var(--crm-accent)]" />
            </div>
            <CardTitle className="text-base">Needs scheduling</CardTitle>
          </div>
          {items.length > 0 && (
            <span className="text-sm font-semibold text-[var(--crm-accent)]">
              {items.length} approved job{items.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-6 pb-4 text-sm text-muted-foreground">
            Nothing waiting — every approved job has a slot booked.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {shown.map((item) => {
              const days = daysOut(item.createdAt)
              return (
                <Link
                  key={item.id}
                  href={`/crm/jobs/${item.id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{item.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.serviceType}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.amount != null && (
                      <span className="text-sm font-medium">
                        ${item.amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ageClasses(days)}`}>
                      {days}d
                    </span>
                  </div>
                </Link>
              )
            })}
            {items.length > shown.length && (
              <p className="px-6 py-2.5 text-xs text-muted-foreground">
                + {items.length - shown.length} more approved and unscheduled
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
