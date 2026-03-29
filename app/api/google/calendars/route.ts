import { NextResponse } from "next/server"
import { listCalendars, isCalendarConnected } from "@/lib/google-calendar"
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
      return NextResponse.json({ error: "Not connected" }, { status: 400 })
    }

    const calendars = await listCalendars()
    return NextResponse.json({ calendars })
  } catch (err) {
    console.error("Google calendars error:", err)
    return NextResponse.json({ error: "Failed to fetch calendars" }, { status: 500 })
  }
}
