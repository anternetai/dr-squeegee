import { createClient } from "@supabase/supabase-js"
import { notFound } from "next/navigation"
import { TerritoryWorkspace } from "@/components/squeegee/field/territory-workspace"
import type { Territory, TerritoryDoor } from "@/lib/crm/field/types"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function TerritoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = getAdmin()

  const [{ data: territory }, { data: doorRows }] = await Promise.all([
    supabase.from("territories").select("*").eq("id", id).maybeSingle(),
    supabase.from("doors_territory_doors").select("*").eq("territory_id", id),
  ])

  if (!territory) notFound()

  const doors = (doorRows ?? []).map((d) => ({
    ...d,
    visits: Array.isArray(d.visits) ? d.visits : [],
  })) as TerritoryDoor[]

  return <TerritoryWorkspace territory={territory as Territory} initialDoors={doors} />
}
