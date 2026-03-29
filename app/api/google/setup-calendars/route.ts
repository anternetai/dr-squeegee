import { NextResponse } from "next/server"
import { setupDefaultCalendars, isCalendarConnected } from "@/lib/google-calendar"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
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
      return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 })
    }

    const result = await setupDefaultCalendars()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error("Setup calendars error:", err)
    return NextResponse.json({ error: "Failed to setup calendars" }, { status: 500 })
  }
}
