import { NextResponse } from "next/server"
import { isCalendarConnected, getConnectedAccountInfo } from "@/lib/google-calendar"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
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

    const connected = await isCalendarConnected()

    if (!connected) {
      return NextResponse.json({ connected: false, account: null })
    }

    const account = await getConnectedAccountInfo()
    return NextResponse.json({ connected: true, account })
  } catch (err) {
    console.error("Google status error:", err)
    return NextResponse.json({ connected: false, account: null })
  }
}
