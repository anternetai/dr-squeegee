import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizePhone, sendSms } from "@/lib/squeegee/sms"

// Private feedback from /review. Public endpoint — the customer is not logged
// in — so it writes through the service-role client behind a rate limiter and
// an explicit field allowlist, never from the browser.
//
// An unhappy customer who took the trouble to type something deserves a reply
// today, so this alerts on two channels rather than sitting in a table.

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const MAX_MESSAGE = 4000
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 10 * 60_000 })
    return false
  }
  entry.count++
  return entry.count > 5
}

async function notifySlack(text: string) {
  if (!process.env.SLACK_BOT_TOKEN) return
  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      },
      body: JSON.stringify({ channel: "U0ABZDLENJ1", text }),
    })
  } catch (err) {
    console.error("[feedback] Slack post failed:", err)
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many submissions. Try again shortly." }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const message = String(body?.message ?? "").trim()
  if (!message) {
    return NextResponse.json({ error: "Please tell us what happened." }, { status: 400 })
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "That message is too long." }, { status: 400 })
  }

  const name = String(body?.name ?? "").trim().slice(0, 120) || null
  const rawPhone = String(body?.phone ?? "").trim().slice(0, 40) || null
  const email = String(body?.email ?? "").trim().slice(0, 200) || null
  const supabase = getAdmin()

  // Attribute to a client when the phone matches one we know. Stored phones are
  // formatted inconsistently, so narrow in SQL by last 4 then exact-match in JS.
  let clientId: string | null = null
  const norm = normalizePhone(rawPhone)
  if (norm) {
    const { data: clients } = await supabase
      .from("squeegee_clients")
      .select("id, phone")
      .ilike("phone", `%${norm.phone10.slice(-4)}`)
    clientId =
      (clients ?? []).find((c) => normalizePhone(c.phone as string | null)?.phone10 === norm.phone10)?.id ?? null
  }

  const { error } = await supabase.from("squeegee_feedback").insert({
    name,
    phone: rawPhone,
    email,
    message,
    client_id: clientId,
    source: "review_page",
  })

  if (error) {
    console.error("[feedback] insert failed:", error)
    // Still alert — losing the row is bad, losing the customer is worse.
    await notifySlack(
      `⚠️ *Feedback came in but did NOT save* (${error.message})\n*From:* ${name ?? "anonymous"} ${rawPhone ?? ""}\n> ${message}`
    )
    return NextResponse.json({ error: "Could not save that. Please call us at (704) 286-9696." }, { status: 500 })
  }

  const who = `${name ?? "Anonymous"}${rawPhone ? ` · ${rawPhone}` : ""}${clientId ? " · known client" : ""}`
  await notifySlack(`🗣️ *Private feedback — needs a callback today*\n*From:* ${who}\n> ${message}`)

  // And a text, because Slack gets muted in the field.
  const ownerPhone = process.env.OWNER_PHONE || process.env.SMS_TEST_TO
  if (ownerPhone) {
    const short = message.length > 200 ? `${message.slice(0, 200)}…` : message
    await sendSms({
      phone: ownerPhone,
      body: `Dr. Squeegee: Private feedback from ${name ?? "a customer"}${rawPhone ? ` (${rawPhone})` : ""}: "${short}" - call them back today.`,
      kind: "owner_feedback_alert",
      force: true,
    }).catch((err) => console.error("[feedback] owner SMS failed:", err))
  }

  return NextResponse.json({ ok: true })
}
