import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyApptToken } from "@/lib/squeegee/appt-token"
import { buildCustomerIcs } from "@/lib/squeegee/ics"

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Public .ics for a customer's appointment — access gated by the signed token.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const jobId = await verifyApptToken(token)
  if (!jobId) return NextResponse.json({ error: "Invalid link" }, { status: 404 })

  const { data: job } = await getAdmin()
    .from("squeegee_jobs")
    .select("service_type, address, appointment_date, appointment_time")
    .eq("id", jobId)
    .single()

  if (!job || !job.appointment_date) {
    return NextResponse.json({ error: "No appointment set" }, { status: 404 })
  }

  const ics = buildCustomerIcs({
    service: (job.service_type as string) || "Service",
    date: job.appointment_date as string,
    time: (job.appointment_time as string | null) ?? null,
    address: job.address as string,
  })

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="dr-squeegee-${job.appointment_date}.ics"`,
    },
  })
}
