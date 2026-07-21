import { redirect } from "next/navigation"

// /crm/jobs/new is retired — "New Job" and "New Quote" are now the same single
// flow (client search-or-create -> smart lines -> one submit). Old bookmarks/
// links with ?client_id= still work, just land in the unified flow instead.
interface PageProps {
  searchParams: Promise<{ client_id?: string }>
}

export default async function NewJobRedirectPage({ searchParams }: PageProps) {
  const { client_id } = await searchParams
  redirect(client_id ? `/crm/quotes/new?client_id=${client_id}` : "/crm/quotes/new")
}
