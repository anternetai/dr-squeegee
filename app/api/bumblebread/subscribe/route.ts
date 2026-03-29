import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, phone, sms_opt_in } = body

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 })
    }

    // Validate phone if provided
    const cleanPhone = phone?.trim() || null
    if (cleanPhone && !/^[\d\s()\-+.]{7,20}$/.test(cleanPhone)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 })
    }

    const { error: dbError } = await getSupabase()
      .from("bumblebread_subscribers")
      .upsert(
        {
          email: email.trim().toLowerCase(),
          phone: cleanPhone,
          sms_opt_in: sms_opt_in === true && !!cleanPhone,
          source: "website",
        },
        { onConflict: "email" }
      )

    if (dbError) {
      console.error("Supabase error:", dbError)
      return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 })
    }

    // Email Bianca about new subscriber
    const resendApiKey = process.env.RESEND_API_KEY
    const ownerEmail = process.env.BUMBLEBREAD_OWNER_EMAIL

    if (resendApiKey && ownerEmail) {
      const safeEmail = escapeHtml(email.trim())
      const safePhone = cleanPhone ? escapeHtml(cleanPhone) : null

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "The Bumblebread Club <anthony@homefieldhub.com>",
            to: [ownerEmail],
            subject: "New Club Member!",
            html: `
              <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 20px; background: #FAF7F2; color: #1B1464;">
                <h2 style="color: #C9A84C;">New Subscriber</h2>
                <p><strong>Email:</strong> ${safeEmail}</p>
                ${safePhone ? `<p><strong>Phone:</strong> ${safePhone}</p>` : ""}
                <p><strong>SMS opt-in:</strong> ${sms_opt_in === true ? "Yes" : "No"}</p>
              </div>
            `,
          }),
        })
      } catch (emailErr) {
        console.error("Resend notification failed:", emailErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Subscribe API error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
