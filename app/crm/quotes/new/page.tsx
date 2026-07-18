import { createClient } from "@/lib/supabase/server"
import { SqueegeeClient } from "@/lib/squeegee/types"
import { QuickQuoteFlow } from "@/components/squeegee/quick-quote-flow"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function NewQuotePage() {
  const supabase = await createClient()

  // A few hundred rows max — cheap to preload for client-side type-ahead search.
  const { data: clients } = await supabase
    .from("squeegee_clients")
    .select("id, name, phone, email, address")
    .order("name", { ascending: true })

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
      <QuickQuoteFlow clients={(clients || []) as Pick<SqueegeeClient, "id" | "name" | "phone" | "email" | "address">[]} />
    </div>
  )
}
