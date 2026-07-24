import { createClient } from "@supabase/supabase-js"
import { verifyApptToken } from "@/lib/squeegee/appt-token"
import { googleCalUrl } from "@/lib/squeegee/ics"
import { formatApptLabel } from "@/lib/squeegee/sms-templates"

export const dynamic = "force-dynamic"

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export default async function ApptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const jobId = await verifyApptToken(token)
  const job = jobId
    ? (
        await getAdmin()
          .from("squeegee_jobs")
          .select("client_name, service_type, address, appointment_date, appointment_time")
          .eq("id", jobId)
          .single()
      ).data
    : null

  if (!job || !job.appointment_date) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-6 text-center" style={{ colorScheme: "dark" }}>
        <p className="text-lg font-semibold">This appointment link is invalid or expired.</p>
        <p className="text-sm text-gray-400 mt-2">Text or call us at (704) 286-9696 and we&apos;ll sort it out.</p>
      </div>
    )
  }

  const service = (job.service_type as string) && job.service_type !== "Pending Quote" ? (job.service_type as string) : "Service"
  const whenLabel = formatApptLabel(job.appointment_date as string, (job.appointment_time as string | null) ?? null)
  const gcal = googleCalUrl({
    service,
    date: job.appointment_date as string,
    time: (job.appointment_time as string | null) ?? null,
    address: job.address as string,
  })
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address as string)}`
  const first = (job.client_name as string || "there").trim().split(/\s+/)[0]

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center px-6" style={{ colorScheme: "dark" }}>
      <div className="w-full max-w-sm text-center space-y-6">
        <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-16 w-auto mx-auto" />
        <div>
          <p className="text-xs uppercase tracking-widest text-[#2D8C6F] font-semibold">You&apos;re booked, {first}</p>
          <h1 className="text-2xl font-bold mt-1">{service}</h1>
        </div>

        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5 space-y-3 text-left">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">When</p>
            <p className="font-semibold text-lg">{whenLabel}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Where</p>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-200 underline decoration-gray-600 underline-offset-2">
              {job.address as string}
            </a>
          </div>
        </div>

        <div className="space-y-2.5">
          <p className="text-sm text-gray-400">Add it to your calendar so it&apos;s not forgotten:</p>
          <a href={gcal} target="_blank" rel="noopener noreferrer" className="block w-full rounded-xl bg-[#2D8C6F] py-3.5 font-semibold text-white hover:bg-[#1F6B54]">
            Add to Google Calendar
          </a>
          <a href={`/appt/${token}/calendar`} className="block w-full rounded-xl border border-[#242424] py-3.5 font-semibold text-gray-200 hover:bg-white/5">
            Add to Apple / Other (.ics)
          </a>
        </div>

        <p className="text-xs text-gray-600">Need to reschedule? Text or call (704) 286-9696.</p>
      </div>
    </div>
  )
}
