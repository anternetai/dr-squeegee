import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export interface UnclaimedJobItem {
  id: string
  clientName: string
  serviceType: string
  whenLabel: string
  hoursOut: number
}

/**
 * The safety net for the claim pool.
 *
 * Jobs reach the crew by sitting on an open board for someone to claim, which
 * means a job can have nobody's name on it. That's fine a week out and a problem
 * tomorrow morning — so anything inside 24 hours with no claim shows up here,
 * loudly, and a job can never quietly go unworked.
 */
export function UnclaimedJobs({ items }: { items: UnclaimedJobItem[] }) {
  if (items.length === 0) return null

  return (
    <Card className="border-[var(--crm-attention)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-[var(--crm-attention-bg)]">
            <AlertTriangle className="h-4 w-4 text-[var(--crm-attention)]" />
          </div>
          <CardTitle className="text-base text-[var(--crm-attention)]">
            Nobody claimed {items.length === 1 ? "this job" : `these ${items.length} jobs`}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/crm/jobs/${item.id}`}
              className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{item.clientName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.serviceType} · {item.whenLabel}
                </p>
              </div>
              <span className="ml-3 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-[var(--crm-attention-bg)] text-[var(--crm-attention)]">
                {item.hoursOut <= 0 ? "now" : `${item.hoursOut}h`}
              </span>
            </Link>
          ))}
        </div>
        <p className="px-6 py-2.5 text-xs text-muted-foreground">
          Assign someone directly, or run it yourself.
        </p>
      </CardContent>
    </Card>
  )
}
