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

const ALLOWED_LOAF_NAMES = ["Doja's Loaf", "Ed's Loaf", "Livet's Loaf"]
const MAX_QTY_PER_LOAF = 5

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customer_name, phone, loaves, notes } = body

    if (!customer_name?.trim() || !phone?.trim() || !Array.isArray(loaves) || loaves.length === 0) {
      return NextResponse.json(
        { error: "Name, phone, and at least one loaf are required" },
        { status: 400 }
      )
    }

    // Validate phone format (digits, spaces, dashes, parens only)
    const cleanPhone = phone.trim()
    if (!/^[\d\s()\-+.]{7,20}$/.test(cleanPhone)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 })
    }

    // Validate each loaf entry
    for (const loaf of loaves) {
      if (!ALLOWED_LOAF_NAMES.includes(loaf.name)) {
        return NextResponse.json({ error: "Unknown loaf selected" }, { status: 400 })
      }
      if (!Number.isInteger(loaf.qty) || loaf.qty < 1 || loaf.qty > MAX_QTY_PER_LOAF) {
        return NextResponse.json(
          { error: `Quantity must be between 1 and ${MAX_QTY_PER_LOAF}` },
          { status: 400 }
        )
      }
      if (typeof loaf.presliced !== "boolean") {
        return NextResponse.json({ error: "Invalid presliced value" }, { status: 400 })
      }
    }

    // Save to Supabase
    const { error: dbError } = await getSupabase()
      .from("bumblebread_orders")
      .insert({
        customer_name: customer_name.trim(),
        phone: cleanPhone,
        loaves,
        notes: notes?.trim() || null,
        status: "pending",
      })

    if (dbError) {
      console.error("Supabase error:", dbError)
      return NextResponse.json({ error: "Failed to save order" }, { status: 500 })
    }

    // Email Bianca via Resend
    const resendApiKey = process.env.RESEND_API_KEY
    const ownerEmail = process.env.BUMBLEBREAD_OWNER_EMAIL

    if (resendApiKey && ownerEmail) {
      const loafSummary = loaves
        .map(
          (l: { name: string; qty: number; presliced: boolean }) =>
            `${l.qty}x ${escapeHtml(l.name)}${l.presliced ? " (presliced)" : ""}`
        )
        .join(", ")

      const safeName = escapeHtml(customer_name.trim())
      const safePhone = escapeHtml(cleanPhone)
      const safeNotes = notes?.trim() ? escapeHtml(notes.trim()) : null

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Bumblebread Orders <anthony@homefieldhub.com>",
            to: [ownerEmail],
            subject: `New Order: ${customer_name.trim().replace(/[^\w\s'-]/g, "").slice(0, 50)}`,
            html: `
              <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 20px; background: #FAF7F2; color: #1B1464;">
                <h2 style="color: #C9A84C; margin-bottom: 4px;">New Bumblebread Order</h2>
                <hr style="border: none; border-top: 1px solid #E0D8C8; margin: 16px 0;" />
                <p><strong>Name:</strong> ${safeName}</p>
                <p><strong>Phone:</strong> ${safePhone}</p>
                <p><strong>Loaves:</strong> ${loafSummary}</p>
                ${safeNotes ? `<p><strong>Notes:</strong> ${safeNotes}</p>` : ""}
                <hr style="border: none; border-top: 1px solid #E0D8C8; margin: 16px 0;" />
                <p style="font-size: 13px; color: #6B6380;">This order was placed on thebumblebreadclub.com</p>
              </div>
            `,
          }),
        })
      } catch (emailErr) {
        console.error("Resend email failed:", emailErr)
        // Don't fail the order if email fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Order API error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
