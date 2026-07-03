import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CalendarRange, Plus } from "lucide-react"
import {
  formatMoney,
  PLAN_STATUS_LABELS,
  type PlanStatus,
  type SqueegeePlan,
} from "@/lib/squeegee/plans"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const STATUS_BADGE: Record<PlanStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  signed: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
}

export default async function PlansPage() {
  const supabase = getAdmin()

  const { data: plans } = await supabase
    .from("squeegee_plans")
    .select("*")
    .order("created_at", { ascending: false })

  const allPlans = (plans ?? []) as SqueegeePlan[]

  const { count: rescheduleCount } = await supabase
    .from("squeegee_plan_visits")
    .select("id", { count: "exact", head: true })
    .eq("status", "reschedule_requested")

  const livePlans = allPlans.filter((p) => p.status === "signed" || p.status === "active")
  const bookedRevenue = livePlans.reduce((sum, p) => sum + Number(p.total_price), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Annual Plans</h1>
          <p className="text-sm text-muted-foreground">
            {livePlans.length} live &middot; {formatMoney(bookedRevenue)} booked
            {rescheduleCount ? (
              <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
                &middot; {rescheduleCount} reschedule request{rescheduleCount !== 1 ? "s" : ""}
              </span>
            ) : null}
          </p>
        </div>
        <Button asChild>
          <Link href="/crm/plans/new">
            <Plus className="h-4 w-4 mr-2" />
            New Plan
          </Link>
        </Button>
      </div>

      {allPlans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <CalendarRange className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">No plans yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Build your first Annual Exterior Care Plan — quote it, sign it at the door, done.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {allPlans.map((plan) => (
            <Link
              key={plan.id}
              href={`/crm/plans/${plan.id}`}
              className="block rounded-xl border border-border bg-card px-4 py-3.5 hover:border-[#2D8C6F]/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{plan.client_name}</p>
                    <span
                      className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${STATUS_BADGE[plan.status]}`}
                    >
                      {PLAN_STATUS_LABELS[plan.status]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{plan.address}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold tabular-nums">{formatMoney(Number(plan.total_price))}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {plan.billing === "paid_in_full"
                      ? `PIF · ${Number(plan.discount_percent)}% off`
                      : `${formatMoney(Number(plan.monthly_price ?? 0))}/mo`}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
