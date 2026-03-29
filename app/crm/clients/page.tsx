import { createClient } from "@/lib/supabase/server"
import { SqueegeeClient } from "@/lib/squeegee/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus, Users, Phone, Mail } from "lucide-react"

interface ClientWithJobCount extends SqueegeeClient {
  job_count: number
}

export default async function ClientsPage() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from("squeegee_clients")
    .select("*")
    .order("name", { ascending: true })

  const allClients = (clients || []) as SqueegeeClient[]

  // Fetch job counts per client
  const { data: jobCounts } = await supabase
    .from("squeegee_jobs")
    .select("client_id")
    .not("client_id", "is", null)

  const countMap: Record<string, number> = {}
  for (const row of jobCounts || []) {
    if (row.client_id) {
      countMap[row.client_id] = (countMap[row.client_id] || 0) + 1
    }
  }

  const clientsWithCounts: ClientWithJobCount[] = allClients.map((c) => ({
    ...c,
    job_count: countMap[c.id] || 0,
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {clientsWithCounts.length} client{clientsWithCounts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white">
          <Link href="/crm/clients/new">
            <Plus className="h-4 w-4 mr-2" />
            New Client
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      {clientsWithCounts.length === 0 ? (
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
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Address</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Jobs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {clientsWithCounts.map((client) => (
                      <tr
                        key={client.id}
                        className="hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <Link href={`/crm/clients/${client.id}`} className="block font-medium hover:text-[#3A6B4C]">
                            {client.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <Link href={`/crm/clients/${client.id}`} className="block">
                            {client.phone || "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <Link href={`/crm/clients/${client.id}`} className="block truncate max-w-[180px]">
                            {client.email || "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <Link href={`/crm/clients/${client.id}`} className="block truncate max-w-[200px]">
                            {client.address || "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/crm/clients/${client.id}`} className="block">
                            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold bg-[#E8F0EA] text-[#1E3E2B] dark:bg-[#1A2E21] dark:text-[#A8C4B0]">
                              {client.job_count}
                            </span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {clientsWithCounts.map((client) => (
              <Link key={client.id} href={`/crm/clients/${client.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{client.name}</p>
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold bg-[#E8F0EA] text-[#1E3E2B] dark:bg-[#1A2E21] dark:text-[#A8C4B0]">
                        {client.job_count} job{client.job_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {client.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {client.phone}
                        </span>
                      )}
                      {client.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </span>
                      )}
                      {client.address && (
                        <span className="truncate text-xs">{client.address}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
