import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyCrmAuth } from "@/lib/crm-auth-check"
import { sendSms, sendSmsWithLink, normalizePhone } from "@/lib/squeegee/sms"

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Anthony-initiated text to a customer. He's in the conversation, so this can
// override the consent gate (force) — but opt-out is still absolute inside
// sendSms. Optionally records consent on the client when he confirms they agreed.
export async function POST(req: NextRequest) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  if (!body?.phone || !body?.body) {
    return NextResponse.json({ error: "phone and body required" }, { status: 400 })
  }
  const norm = normalizePhone(body.phone)
  if (!norm) return NextResponse.json({ error: "invalid phone" }, { status: 400 })

  // Record consent if Anthony confirms the customer agreed to texts.
  if (body.set_consent && body.client_id) {
    await getAdmin()
      .from("squeegee_clients")
      .update({ sms_consent: true, sms_consent_at: new Date().toISOString() })
      .eq("id", String(body.client_id))
  }

  const common = {
    phone: body.phone as string,
    body: String(body.body),
    kind: body.kind ? String(body.kind) : "manual",
    relatedType: body.client_id ? "client" : null,
    relatedId: body.client_id ? String(body.client_id) : null,
    force: body.force !== false, // manual admin sends default to force; opt-out still blocks
  }

  // When the caller has a URL to deliver it passes it as `link`, never baked
  // into `body` — the link then goes out as its own message so iMessage renders
  // a preview card and no linkifier can swallow adjacent punctuation.
  const result = body.link
    ? await sendSmsWithLink({ ...common, link: String(body.link) })
    : await sendSms(common)

  if (!result.sent) {
    return NextResponse.json({ ok: false, reason: result.reason, test: result.test }, { status: 200 })
  }
  return NextResponse.json({ ok: true, test: result.test })
}
