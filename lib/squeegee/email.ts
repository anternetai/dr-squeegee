// Dr. Squeegee Care Club — transactional email via Resend (raw API, no SDK).
// Sends from the Resend-verified HFH address until drsqueegeeclt.com is
// verified as a sending domain; replies route to care@drsqueegeeclt.com
// (Cloudflare Email Routing → Gmail). Always fire-and-forget — never block
// the customer's flow on email delivery.

import { BRAND, CLUB_NAME } from "@/lib/squeegee/brand"

const FROM = "Dr. Squeegee <anthony@homefieldhub.com>"
const REPLY_TO = "care@drsqueegeeclt.com"
const SITE = "https://www.drsqueegeeclt.com"
const LOGO = `${SITE}/images/squeegee/logo-badge.png`

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function layout(inner: string): string {
  return `
  <div style="background:#0A0A0A;padding:32px 16px;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;">
      <div style="text-align:center;padding-bottom:20px;">
        <img src="${LOGO}" alt="Dr. Squeegee" height="64" style="height:64px;width:auto;" />
      </div>
      <div style="background:#111111;border:1px solid #242424;border-radius:16px;padding:28px 24px;color:#FFFFFF;">
        ${inner}
      </div>
      <p style="text-align:center;color:rgba(255,255,255,0.35);font-size:12px;margin-top:20px;">
        ${BRAND.name} &middot; ${BRAND.tagline}<br/>
        Questions? Reply to this email or call/text ${BRAND.phone}
      </p>
    </div>
  </div>`
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#2D8C6F;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:12px;margin:8px 0;">${label}</a>`
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping:", subject)
    return
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html }),
    })
    if (!res.ok) {
      console.error("[email] Resend error:", res.status, await res.text())
    }
  } catch (err) {
    console.error("[email] send failed:", err)
  }
}

interface PlanEmailInfo {
  client_name: string
  client_email: string
  address: string
  total_price: number
  annual_value: number
  billing: string
  portal_token: string
  services: { name: string; visits_per_year: number }[]
}

// (a) Right after signing — the congrats/receipt moment.
export async function sendWelcomeEmail(plan: PlanEmailInfo): Promise<void> {
  if (!plan.client_email) return
  const first = escapeHtml(plan.client_name.split(" ")[0])
  const rows = plan.services
    .map(
      (s) =>
        `<tr><td style="padding:6px 0;color:rgba(255,255,255,0.85);">${escapeHtml(s.name)}</td><td style="padding:6px 0;text-align:right;color:rgba(255,255,255,0.45);">${s.visits_per_year}&times;/year</td></tr>`
    )
    .join("")
  const pif = plan.billing === "paid_in_full"
  const html = layout(`
    <h1 style="margin:0 0 6px;font-size:22px;">Welcome to the family, ${first}! 🎉</h1>
    <p style="color:rgba(255,255,255,0.6);margin:0 0 18px;font-size:14px;line-height:1.6;">
      Your <strong style="color:#fff;">${CLUB_NAME}</strong> plan for
      ${escapeHtml(plan.address)} is signed and official.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
    <div style="border-top:1px solid #242424;margin:14px 0;padding-top:14px;font-size:14px;">
      <span style="color:rgba(255,255,255,0.5);">${pif ? "Paid in full" : "Monthly plan"} &middot; </span>
      <span style="color:#2D8C6F;font-weight:bold;">$${Number(plan.total_price).toLocaleString()}</span>
      <span style="color:rgba(255,255,255,0.35);text-decoration:line-through;margin-left:6px;">$${Number(plan.annual_value).toLocaleString()}</span>
    </div>
    <p style="color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">
      Your member portal has your full visit schedule — see what's coming, reschedule
      visits, and reach us anytime:
    </p>
    <div style="text-align:center;margin-top:6px;">
      ${button(`${SITE}/portal/${plan.portal_token}`, "Open My Care Club Portal")}
    </div>
  `)
  await send(plan.client_email, `Welcome to the ${CLUB_NAME}, ${first}! 🧼`, html)
}

// (b) After they create their login.
export async function sendAccountEmail(
  to: string,
  clientName: string,
  memberNumber: number,
  slug: string | null
): Promise<void> {
  const first = escapeHtml(clientName.split(" ")[0])
  const personalUrl = slug ? `${SITE}/portal/${slug}` : `${SITE}/portal`
  const html = layout(`
    <h1 style="margin:0 0 6px;font-size:22px;">You're in, ${first}!</h1>
    <p style="color:rgba(255,255,255,0.6);margin:0 0 16px;font-size:14px;line-height:1.6;">
      Your ${CLUB_NAME} login is set up.
    </p>
    <div style="background:#0A0A0A;border:1px solid #242424;border-radius:12px;padding:16px;font-size:14px;line-height:1.9;">
      <span style="color:rgba(255,255,255,0.5);">Member #:</span> <strong>${String(memberNumber).padStart(4, "0")}</strong><br/>
      <span style="color:rgba(255,255,255,0.5);">Login email:</span> <strong>${escapeHtml(to)}</strong><br/>
      <span style="color:rgba(255,255,255,0.5);">Your personal link:</span> <strong style="color:#2D8C6F;">${personalUrl.replace("https://www.", "")}</strong>
    </div>
    <p style="color:rgba(255,255,255,0.6);font-size:13px;line-height:1.6;margin-top:16px;">
      Save this email! Sign in anytime at drsqueegeeclt.com/portal — and add it to your
      phone's home screen for one-tap access.
    </p>
    <div style="text-align:center;margin-top:6px;">
      ${button(personalUrl, "Open My Portal")}
    </div>
  `)
  await send(to, `Your ${CLUB_NAME} login is ready`, html)
}

// (c) Forgot password — send their magic link. Subject/copy deliberately avoid
// "sign in" phrasing: Gmail silently dropped that pattern in testing.
export async function sendMagicLinkEmail(
  to: string,
  clientName: string,
  portalToken: string
): Promise<void> {
  const first = escapeHtml(clientName.split(" ")[0])
  const html = layout(`
    <h1 style="margin:0 0 6px;font-size:22px;">Here you go, ${first}!</h1>
    <p style="color:rgba(255,255,255,0.6);margin:0 0 16px;font-size:14px;line-height:1.6;">
      Tap below to open your ${CLUB_NAME} portal — your visit schedule, rescheduling,
      and everything else. No password needed, and you can set a new one from there.
    </p>
    <div style="text-align:center;">
      ${button(`${SITE}/portal/${portalToken}`, "Open My Portal")}
    </div>
    <p style="color:rgba(255,255,255,0.35);font-size:12px;margin-top:16px;">
      Didn't request this? You can safely ignore this email.
    </p>
  `)
  await send(to, `Your ${CLUB_NAME} portal link`, html)
}
