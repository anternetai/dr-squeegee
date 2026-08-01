import { createClient } from "@supabase/supabase-js"
import { SqueegeeClient, SqueegeeJob, STATUS_LABELS, JobStatus } from "@/lib/squeegee/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  Phone,
  Mail,
  MapPin,
  FileText,
  Plus,
  ArrowLeft,
  Briefcase,
} from "lucide-react"
import { ClientDetailClient } from "@/components/squeegee/client-detail-client"
import { ClientSms } from "@/components/squeegee/client-sms"

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

const STATUS_COLORS: Record<JobStatus, string> = {
  new: "bg-[var(--crm-idle-bg)] text-[var(--crm-idle)] dark:bg-[var(--crm-idle-bg)] dark:text-[var(--crm-idle)]",
  quoted: "bg-[var(--crm-attention-bg)] text-[var(--crm-attention)] dark:bg-[var(--crm-attention-bg)] dark:text-[var(--crm-attention)]",
  approved: "bg-[var(--crm-idle-bg)] text-[var(--crm-idle)] dark:bg-[var(--crm-idle-bg)] dark:text-[var(--crm-idle)]",
  scheduled: "bg-[var(--crm-accent-weak)] text-[var(--crm-accent)] dark:bg-[var(--crm-accent-weak)] dark:text-[var(--crm-accent)]",
  complete: "bg-[var(--crm-accent-weak)] text-[var(--crm-accent)] dark:bg-[var(--crm-accent-weak)] dark:text-[var(--crm-accent)]",
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = getAdmin()

  const { data: client, error } = await supabase
    .from("squeegee_clients")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !client) notFound()

  const { data: jobs } = await supabase
    .from("squeegee_jobs")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false })

  const clientJobs = (jobs || []) as SqueegeeJob[]

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
          <Link href="/crm/clients">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Clients
          </Link>
        </Button>
      </div>

      {/* Page title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">{(client as SqueegeeClient).name}</h1>
        <Button asChild className="bg-[var(--crm-accent)] hover:bg-[#2F5A3F] text-white">
          <Link href={`/crm/quotes/new?client_id=${id}`}>
            <Plus className="h-4 w-4 mr-2" />
            New Quote
          </Link>
        </Button>
      </div>

      {/* Client info card — editable */}
      <ClientDetailClient client={client as SqueegeeClient} />

      {/* Quick text + consent */}
      <ClientSms
        clientId={id}
        name={(client as SqueegeeClient).name}
        phone={(client as { phone: string | null }).phone}
        initialConsent={!!(client as { sms_consent?: boolean }).sms_consent}
      />

      {/* Jobs list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Jobs
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({clientJobs.length})
              </span>
            </CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href={`/crm/quotes/new?client_id=${id}`}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Quote
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {clientJobs.length === 0 ? (
            <div className="px-6 py-10 text-center text-muted-foreground">
              <Briefcase className="h-9 w-9 mx-auto mb-3 opacity-25" />
              <p className="text-sm">No jobs for this client yet.</p>
              <Button asChild className="mt-4 bg-[var(--crm-accent)] hover:bg-[#2F5A3F] text-white" size="sm">
                <Link href={`/crm/quotes/new?client_id=${id}`}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New Quote
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {clientJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/crm/jobs/${job.id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{job.service_type === "Pending Quote" ? "New Job" : job.service_type}</p>
                    <p className="text-xs text-muted-foreground truncate">{job.address}</p>
                    {job.appointment_date && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.appointment_date + "T00:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {job.price != null && (
                      <span className="text-sm font-medium">
                        ${Number(job.price).toFixed(2)}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[job.status]}`}>
                      {STATUS_LABELS[job.status]}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
