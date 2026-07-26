import { createClient } from "@supabase/supabase-js"
import { SqueegeeClient } from "@/lib/squeegee/types"
import { QuickQuoteFlow } from "@/components/squeegee/quick-quote-flow"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

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

interface PageProps {
  searchParams: Promise<{
    client_id?: string
    client_name?: string
    client_phone?: string
    client_email?: string
    address?: string
  }>
}

export default async function NewQuotePage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = getAdmin()

  // A few hundred rows max — cheap to preload for client-side type-ahead search.
  const { data: clients } = await supabase
    .from("squeegee_clients")
    .select("id, name, phone, email, address")
    .order("name", { ascending: true })

  // Prefill from a job/client detail page's "New Quote" link — either a real
  // client_id (preferred), or raw name/phone/email/address for jobs that
  // predate the client_id link (backfill script fixes those over time).
  let initialClient: Pick<SqueegeeClient, "id" | "name" | "phone" | "email" | "address"> | null = null
  if (params.client_id) {
    const match = (clients || []).find((c) => c.id === params.client_id)
    if (match) initialClient = match
  } else if (params.client_name) {
    initialClient = {
      id: "",
      name: params.client_name,
      phone: params.client_phone || null,
      email: params.client_email || null,
      address: params.address || null,
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/crm"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold">New Quote</h1>
        <p className="text-sm text-muted-foreground">
          Pick a client, add services, send a quote link — one screen, no extra steps.
        </p>
      </div>
      <QuickQuoteFlow
        clients={(clients || []) as Pick<SqueegeeClient, "id" | "name" | "phone" | "email" | "address">[]}
        initialClient={initialClient}
      />
    </div>
  )
}
