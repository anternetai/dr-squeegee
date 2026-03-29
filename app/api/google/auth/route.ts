import { NextResponse } from "next/server"
import { getAuthUrl } from "@/lib/google-calendar"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    // Verify the requester is an admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: client } = await supabase
      .from("agency_clients")
      .select("role")
      .eq("auth_user_id", user.id)
      .single()

    if (!client || client.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const authUrl = getAuthUrl()
    return NextResponse.redirect(authUrl)
  } catch (err) {
    console.error("Google auth error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
