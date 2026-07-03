import { createClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import { PlanDetailClient } from "@/components/squeegee/plan-detail-client"
import type { PlanVisit, SqueegeePlan } from "@/lib/squeegee/plans"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function PlanDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = getAdmin()

  const { data: plan, error } = await supabase
    .from("squeegee_plans")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !plan) notFound()

  const { data: visits } = await supabase
    .from("squeegee_plan_visits")
    .select("*")
    .eq("plan_id", id)
    .order("scheduled_date", { ascending: true })

  return (
    <PlanDetailClient
      plan={plan as SqueegeePlan}
      visits={(visits ?? []) as PlanVisit[]}
    />
  )
}
