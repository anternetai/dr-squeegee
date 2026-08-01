import { createClient } from "@supabase/supabase-js"
import { SqueegeeInvoice } from "@/lib/squeegee/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { FileText, DollarSign, CheckCircle2, AlertCircle } from "lucide-react"
import { InvoicesTable, type InvoiceRow } from "@/components/squeegee/invoices-table"

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

export default async function InvoicesPage() {
  const supabase = getAdmin()

  // Fetch invoices — also grab job client_name via job_id
  const { data: invoices } = await supabase
    .from("squeegee_invoices")
    .select("*, squeegee_jobs(client_name)")
    .order("created_at", { ascending: false })

  const allInvoices: InvoiceRow[] = (invoices || []).map((inv) => {
    const row = inv as unknown as SqueegeeInvoice & { squeegee_jobs?: { client_name?: string } | null }
    return {
      ...row,
      job_client_name: row.squeegee_jobs?.client_name ?? null,
    }
  })

  // Revenue summary
  const totalInvoiced = allInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const totalPaid = allInvoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const outstanding = allInvoices
    .filter((inv) => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const overdue = allInvoices
    .filter((inv) => inv.status === "overdue")
    .reduce((sum, inv) => sum + (inv.amount || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {allInvoices.length} invoice{allInvoices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/crm/jobs">
            <FileText className="h-4 w-4 mr-2" />
            Create from Job
          </Link>
        </Button>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Invoiced</p>
            </div>
            <p className="text-xl font-bold">
              ${totalInvoiced.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-[var(--crm-accent)] dark:text-[var(--crm-accent)]" />
              <p className="text-xs text-muted-foreground">Paid</p>
            </div>
            <p className="text-xl font-bold text-[var(--crm-accent)] dark:text-[var(--crm-accent)]">
              ${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-[var(--crm-idle)] dark:text-[var(--crm-idle)]" />
              <p className="text-xs text-muted-foreground">Outstanding</p>
            </div>
            <p className="text-xl font-bold text-[var(--crm-idle)] dark:text-[var(--crm-idle)]">
              ${outstanding.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-[var(--crm-dead)] dark:text-[var(--crm-dead)]" />
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
            <p className="text-xl font-bold text-[var(--crm-dead)] dark:text-[var(--crm-dead)]">
              ${overdue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices list */}
      {allInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-25" />
            <p className="font-medium mb-1">No invoices yet</p>
            <p className="text-sm mb-5">
              Create invoices from individual job pages.
            </p>
            <Button asChild variant="outline">
              <Link href="/crm/jobs">View Jobs</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <InvoicesTable invoices={allInvoices} />
      )}
    </div>
  )
}
