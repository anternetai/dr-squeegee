import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/google-calendar"
import { verifyCrmAuth } from "@/lib/crm-auth-check"

export async function GET() {
  try {
    // Verify the requester is logged into the CRM
    const isAuthed = await verifyCrmAuth()

    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const authUrl = getAuthUrl()
    return NextResponse.redirect(authUrl)
  } catch (err) {
    console.error("Google auth error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
