import { createClient } from "@/lib/supabase/server"
import { SqueegeeClient } from "@/lib/squeegee/types"
import { NewJobForm } from "@/components/squeegee/new-job-form"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface PageProps {
  searchParams: Promise<{ client_id?: string }>
}

export default async function NewJobPage({ searchParams }: PageProps) {
  const { client_id } = await searchParams

  let client: SqueegeeClient | null = null
  if (client_id) {
    const supabase = await createClient()
    const { data } = await supabase
      .from("squeegee_clients")
      .select("*")
      .eq("id", client_id)
      .single()
    if (data) client = data as SqueegeeClient
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={client ? `/crm/clients/${client.id}` : "/crm/jobs"}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          {client ? `Back to ${client.name}` : "Back to Jobs"}
        </Link>
        <h1 className="text-2xl font-bold">New Job</h1>
        <p className="text-sm text-muted-foreground">
          {client
            ? `Create a new job for ${client.name}.`
            : "Add a new job."}
        </p>
      </div>
      <NewJobForm client={client} />
    </div>
  )
}
