import { createClient } from "@supabase/supabase-js"
import { PlanBuilder } from "@/components/squeegee/plan-builder"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function NewPlanPage() {
  const supabase = getAdmin()

  const { data: clients } = await supabase
    .from("squeegee_clients")
    .select("id, name, phone, email, address")
    .eq("blacklisted", false)
    .order("name")

  return <PlanBuilder clients={clients ?? []} />
}
