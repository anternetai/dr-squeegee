import { createClient } from "@supabase/supabase-js"
import { SqueegeeClient } from "@/lib/squeegee/types"
import Link from "next/link"
import { Plus, Users } from "lucide-react"
import { ClientsTable, type EnrichedClient } from "@/components/squeegee/clients-table"
import { money } from "@/lib/crm/status"

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

  const lifetime = enriched.reduce((sum, c) => sum + c.total_value, 0)
  const repeat = enriched.filter((c) => c.job_count > 1).length

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Clients</h2>
          <p className="mt-0.5 text-sm text-[var(--crm-text-dim)]">
            {enriched.length} {enriched.length === 1 ? "client" : "clients"}
            {lifetime > 0 && <> · <span className="text-[var(--crm-accent)]">{money(lifetime)}</span> lifetime</>}
            {repeat > 0 && <> · {repeat} repeat</>}
          </p>
        </div>
        <Link
          href="/crm/clients/new"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--crm-accent)] px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--crm-accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          New client
        </Link>
      </div>

      {enriched.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--crm-line)] px-4 py-14 text-center">
          <Users className="mx-auto h-6 w-6 text-[var(--crm-text-faint)]" />
          <p className="mt-2 text-sm font-medium">No clients yet</p>
          <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
            Add your first client to start tracking jobs and invoices.
          </p>
          <Link
            href="/crm/clients/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--crm-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> New client
          </Link>
        </div>
      ) : (
        <ClientsTable clients={enriched} />
      )}
    </div>
  )
}
