import { createClient } from "@supabase/supabase-js"
import { SqueegeeClient } from "@/lib/squeegee/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Users } from "lucide-react"
import { ClientsTable, type EnrichedClient } from "@/components/squeegee/clients-table"

export const dynamic = "force-dynamic"

// Service-role: the CRM is gated by the signed crm_auth cookie in middleware,
// not by a Supabase session, so these queries have no authenticated identity.
// Reading them through the anon key is what forced RLS open to anon.
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function ClientsPage() {
  const supabase = getAdmin()

  const { data: clients } = await supabase
    .from("squeegee_clients")
    .select("*")
    .order("name", { ascending: true })

  const allClients = (clients || []) as SqueegeeClient[]

  // Per-client job count, lifetime value, and last job date
  const { data: jobs } = await supabase
    .from("squeegee_jobs")
    .select("client_id, price, created_at")
    .not("client_id", "is", null)

  const agg: Record<string, { count: number; value: number; last: string | null }> = {}
  for (const j of jobs || []) {
    const id = j.client_id as string | null
    if (!id) continue
    const a = agg[id] || { count: 0, value: 0, last: null }
    a.count += 1
    a.value += Number(j.price) || 0
    if (j.created_at && (!a.last || j.created_at > a.last)) a.last = j.created_at
    agg[id] = a
  }

  const enriched: EnrichedClient[] = allClients.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    blacklisted: c.blacklisted,
    job_count: agg[c.id]?.count || 0,
    total_value: agg[c.id]?.value || 0,
    last_job: agg[c.id]?.last || null,
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {enriched.length} client{enriched.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white">
          <Link href="/crm/clients/new">
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Link>
        </Button>
      </div>

      {enriched.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-25" />
            <p className="font-medium mb-1">No clients yet</p>
            <p className="text-sm mb-5">Add your first client to start tracking jobs and invoices.</p>
            <Button asChild className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white">
              <Link href="/crm/clients/new">
                <Plus className="h-4 w-4 mr-2" />
                New Client
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ClientsTable clients={enriched} />
      )}
    </div>
  )
}
