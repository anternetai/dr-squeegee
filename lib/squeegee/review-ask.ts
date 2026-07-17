import type { SupabaseClient } from "@supabase/supabase-js"

// Paste-ready Google-review ask, appended to payment Slack pings.
// Gated on GOOGLE_REVIEW_URL: unset = feature off (returns ""). Like the
// follow-up digest, this suggests a text for Anthony to send — customers are
// phone-first (no emails on file), and auto-SMS waits on A2P + his approval.
export async function reviewAskLine(
  supabase: SupabaseClient,
  jobId: string | null
): Promise<string> {
  const reviewUrl = process.env.GOOGLE_REVIEW_URL
  if (!reviewUrl || !jobId) return ""

  const { data: job } = await supabase
    .from("squeegee_jobs")
    .select("client_name, client_phone")
    .eq("id", jobId)
    .single()
  if (!job?.client_name) return ""

  const first = String(job.client_name).trim().split(/\s+/)[0]
  const phone = job.client_phone ? ` (${job.client_phone})` : ""
  return (
    `\n\n⭐ *Review ask* — text ${job.client_name}${phone}:\n` +
    `_"${first}, thank you for the business! If you were happy with the work, a quick Google review helps us a ton: ${reviewUrl}"_`
  )
}
