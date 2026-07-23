import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { sendSms } from "@/lib/squeegee/sms"

// Daily follow-up digest — surfaces quotes/plans waiting on a customer answer.
//
// Channel reality (checked 7/16/2026): every pending quote and plan has a phone
// and NONE have an email, so v1 does not send anything to customers. It DMs
// Anthony a ready-to-paste text per item; he sends from his own thread.
// Auto-SMS mode comes when the A2P campaign is verified (Twilio), gated on
// FOLLOWUPS_SMS_ENABLED + his word. followup_count is reserved for real
// customer touches (SMS cap 3); the digest only stamps last_followup_at so an
// item re-surfaces every RESURFACE_DAYS until its status changes.

const WINNABLE_DAYS = 45
const MIN_AGE_DAYS = 3
const RESURFACE_DAYS = 3
const MAX_ITEMS = 8
const SITE = "https://www.drsqueegeeclt.com"
const SLACK_CHANNEL = "U0ABZDLENJ1" // same DM target as the 3 existing notify routes

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface DueItem {
  kind: "quote" | "plan"
  id: string
  clientName: string
  phone: string | null
  amount: number
  daysOut: number
  url: string
  suggestedText: string
}

function firstName(name: string): string {
  return (name || "there").trim().split(/\s+/)[0]
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (process.env.FOLLOWUPS_DIGEST_ENABLED === "false") {
    return NextResponse.json({ ok: true, skipped: "digest disabled" })
  }

  try {
    const supabase = getAdmin()
    const now = Date.now()
    const windowStart = new Date(now - WINNABLE_DAYS * 86_400_000).toISOString()
    const minAge = new Date(now - MIN_AGE_DAYS * 86_400_000).toISOString()
    const resurfaceBefore = new Date(now - RESURFACE_DAYS * 86_400_000).toISOString()

    const [{ data: quotes, error: qErr }, { data: plans, error: pErr }] = await Promise.all([
      supabase
        .from("squeegee_quotes")
        .select("id, token, client_name, client_phone, total_price, created_at, last_followup_at")
        .eq("status", "pending")
        .gte("created_at", windowStart)
        .lte("created_at", minAge)
        .or(`last_followup_at.is.null,last_followup_at.lt.${resurfaceBefore}`),
      supabase
        .from("squeegee_plans")
        .select("id, token, client_name, client_phone, plan_name, total_price, created_at, last_followup_at")
        .eq("status", "sent")
        .gte("created_at", windowStart)
        .lte("created_at", minAge)
        .or(`last_followup_at.is.null,last_followup_at.lt.${resurfaceBefore}`),
    ])
    if (qErr || pErr) {
      console.error("followups query failed:", qErr || pErr)
      return NextResponse.json({ error: "Query failed" }, { status: 500 })
    }

    const items: DueItem[] = [
      ...(quotes || []).map((q) => {
        const url = `${SITE}/q/${q.token}`
        const first = firstName(q.client_name)
        return {
          kind: "quote" as const,
          id: q.id as string,
          clientName: q.client_name as string,
          phone: q.client_phone as string | null,
          amount: Number(q.total_price) || 0,
          daysOut: daysAgo(q.created_at as string),
          url,
          suggestedText: `Hey ${first}, it's Anthony with Dr. Squeegee — just making sure my quote made it to you. Happy to answer anything: ${url}`,
        }
      }),
      ...(plans || []).map((p) => {
        const url = `${SITE}/a/${p.token}`
        const first = firstName(p.client_name)
        return {
          kind: "plan" as const,
          id: p.id as string,
          clientName: p.client_name as string,
          phone: p.client_phone as string | null,
          amount: Number(p.total_price) || 0,
          daysOut: daysAgo(p.created_at as string),
          url,
          suggestedText: `Hey ${first}, Anthony with Dr. Squeegee — your ${p.plan_name || "care plan"} agreement is ready whenever you are. Questions? Just text back: ${url}`,
        }
      }),
    ]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, MAX_ITEMS)

    if (items.length === 0) {
      return NextResponse.json({ ok: true, due: 0 })
    }

    const total = items.reduce((s, i) => s + i.amount, 0)
    const lines = items.map((i, idx) => {
      const label = i.kind === "plan" ? "plan" : "quote"
      return (
        `*${idx + 1}) ${i.clientName}* — $${i.amount.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${label} · ${i.daysOut}d out · ${i.phone || "no phone"}\n` +
        `_${i.suggestedText}_`
      )
    })
    const text =
      `🧭 *Follow-up digest* — $${total.toLocaleString("en-US", { maximumFractionDigits: 0 })} waiting on a yes (${items.length} due)\n\n` +
      lines.join("\n\n") +
      `\n\n_Copy, tweak, text. Items re-surface every ${RESURFACE_DAYS} days until they answer._`

    const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel: SLACK_CHANNEL, text }),
    })
    const slackJson = (await slackRes.json()) as { ok: boolean; error?: string }
    if (!slackJson.ok) {
      // Don't stamp last_followup_at if the digest never reached him.
      console.error("followups digest Slack post failed:", slackJson.error)
      return NextResponse.json({ error: `Slack: ${slackJson.error}` }, { status: 502 })
    }

    // Auto-SMS the follow-ups when enabled — consent + opt-out + test-mode all
    // enforced inside sendSms, so a no-consent number is simply skipped. The
    // digest above still goes to Anthony either way, so he sees what went out.
    if (process.env.FOLLOWUPS_SMS_ENABLED === "true") {
      for (const i of items) {
        if (!i.phone) continue
        const body = `Dr. Squeegee: Hi ${firstName(i.clientName)}, just following up — still happy to get you taken care of: ${i.url}. Reply STOP to opt out.`
        await sendSms({ phone: i.phone, body, kind: "quote_followup", relatedType: i.kind, relatedId: i.id }).catch(() => {})
      }
    }

    const stamp = new Date().toISOString()
    const quoteIds = items.filter((i) => i.kind === "quote").map((i) => i.id)
    const planIds = items.filter((i) => i.kind === "plan").map((i) => i.id)
    if (quoteIds.length > 0) {
      await supabase.from("squeegee_quotes").update({ last_followup_at: stamp }).in("id", quoteIds)
    }
    if (planIds.length > 0) {
      await supabase.from("squeegee_plans").update({ last_followup_at: stamp }).in("id", planIds)
    }

    return NextResponse.json({ ok: true, due: items.length, total })
  } catch (err) {
    console.error("followups cron error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
