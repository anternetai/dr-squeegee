import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { sendSms } from "@/lib/squeegee/sms"
import { smsTemplates } from "@/lib/squeegee/sms-templates"

// Day-before appointment reminders for scheduled jobs and care-plan visits.
// Runs daily (late afternoon ET). Consent + opt-out + test-mode are all enforced
// inside sendSms; this route just finds what's due tomorrow and texts it once.

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Tomorrow's date (YYYY-MM-DD) in America/New_York.
function tomorrowET(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(Date.now() + 86_400_000))
  const get = (t: string) => parts.find((p) => p.type === t)?.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

function timeLabel(t: string | null): string {
  if (!t) return "tomorrow"
  const [h, m] = t.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hr = h % 12 || 12
  const min = m ? `:${String(m).padStart(2, "0")}` : ""
  return `tomorrow at ${hr}${min} ${ampm}`
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getAdmin()
  const day = tomorrowET()
  const now = new Date().toISOString()
  const results = { jobs: 0, visits: 0, blocked: 0, test: false as boolean }

  // Scheduled jobs happening tomorrow, not yet reminded.
  const { data: jobs } = await supabase
    .from("squeegee_jobs")
    .select("id, client_name, client_phone, service_type, appointment_time")
    .eq("status", "scheduled")
    .eq("appointment_date", day)
    .is("reminder_sent_at", null)

  for (const j of jobs ?? []) {
    const r = await sendSms({
      phone: j.client_phone as string | null,
      body: smsTemplates.appointmentReminder(j.client_name as string, (j.service_type as string) || "service", timeLabel(j.appointment_time as string | null)),
      kind: "reminder",
      relatedType: "job",
      relatedId: j.id as string,
    })
    results.test = r.test
    if (r.sent) {
      results.jobs++
      await supabase.from("squeegee_jobs").update({ reminder_sent_at: now }).eq("id", j.id)
    } else if (r.reason === "no consent" || r.reason === "opted out") {
      results.blocked++
    }
  }

  // Care-plan visits scheduled tomorrow, not yet reminded — join the plan for contact.
  const { data: visits } = await supabase
    .from("squeegee_plan_visits")
    .select("id, service_name, plan_id, squeegee_plans!inner(client_name, client_phone)")
    .eq("status", "scheduled")
    .eq("scheduled_date", day)
    .is("reminder_sent_at", null)

  for (const v of visits ?? []) {
    const rel = (v as unknown as { squeegee_plans: { client_name: string; client_phone: string | null } | { client_name: string; client_phone: string | null }[] }).squeegee_plans
    const plan = Array.isArray(rel) ? rel[0] : rel
    const r = await sendSms({
      phone: plan?.client_phone,
      body: smsTemplates.appointmentReminder(plan?.client_name, (v.service_name as string) || "service", "tomorrow"),
      kind: "reminder",
      relatedType: "plan_visit",
      relatedId: v.id as string,
    })
    results.test = r.test
    if (r.sent) {
      results.visits++
      await supabase.from("squeegee_plan_visits").update({ reminder_sent_at: now }).eq("id", v.id)
    } else if (r.reason === "no consent" || r.reason === "opted out") {
      results.blocked++
    }
  }

  return NextResponse.json({ ok: true, date: day, ...results })
}
