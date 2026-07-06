import { createClient } from "@supabase/supabase-js"
import { PitchBuilder } from "@/components/squeegee/pitch-builder"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface PageProps {
  searchParams: Promise<{ client?: string; phone?: string }>
}

export default async function PitchPage({ searchParams }: PageProps) {
  const { client: clientParam, phone: phoneParam } = await searchParams
  const supabase = getAdmin()

  const [{ data: clients }, { data: jobs }] = await Promise.all([
    supabase
      .from("squeegee_clients")
      .select("id, name, phone, email, address")
      .eq("blacklisted", false)
      .order("name"),
    supabase
      .from("squeegee_jobs")
      .select("client_phone, service_type, price, appointment_date, created_at")
      .order("created_at", { ascending: false }),
  ])

  return (
    <PitchBuilder
      clients={clients ?? []}
      jobs={jobs ?? []}
      initialClientId={clientParam ?? null}
      initialPhone={phoneParam ?? null}
    />
  )
}
