import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyCrmAuth } from "@/lib/crm-auth-check"
import type { DoorVisit, TerritoryDoor } from "@/lib/the-move/types"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

/** Derive a door status string from the most recent visit. */
function deriveStatus(visits: DoorVisit[]): string {
  if (visits.length === 0) return "not_home"
  const latest = visits[visits.length - 1]
  if (latest.closed) return "closed"
  if (latest.not_interested) return "not_interested"
  if (latest.pitched) return "pitched"
  if (latest.answered) return "talked"
  return "not_home"
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> },
) {
  const authed = await verifyCrmAuth()
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, id } = await params

  const body = await req.json()
  const { visit } = body as { visit: DoorVisit }

  if (!visit) {
    return NextResponse.json({ error: "visit is required" }, { status: 400 })
  }

  const supabase = getSupabase()

  // Fetch current door
  const { data: door, error: fetchError } = await supabase
    .from("territory_doors")
    .select("*")
    .eq("id", id)
    .single()

  if (fetchError || !door) {
    return NextResponse.json({ error: "Door not found" }, { status: 404 })
  }

  const currentDoor = door as TerritoryDoor
  const updatedVisits: DoorVisit[] = [...((currentDoor.visits as DoorVisit[]) ?? []), visit]
  const newStatus = deriveStatus(updatedVisits)

  const { data: updated, error: updateError } = await supabase
    .from("territory_doors")
    .update({
      visits: updatedVisits,
      status: newStatus,
      total_visits: updatedVisits.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Sync to door_knocks so The Move portal picks up CRM-logged sessions
  const territoryName = decodeURIComponent(name)
  const visitDate = visit.date || new Date().toISOString().split("T")[0]

  try {
    // Get all doors in this territory for this date to compute session totals
    const { data: allDoors } = await supabase
      .from("territory_doors")
      .select("visits")
      .eq("neighborhood", territoryName)

    let knocked = 0, opened = 0, pitched = 0, closed = 0, revenue = 0
    for (const d of allDoors ?? []) {
      for (const v of (d.visits as DoorVisit[]) ?? []) {
        if (v.date !== visitDate) continue
        knocked++
        if (v.answered) opened++
        if (v.pitched) pitched++
        if (v.closed) { closed++; revenue += v.revenue ?? 0 }
      }
    }

    // Upsert: find existing door_knocks for this date+neighborhood, or create
    const { data: existing } = await supabase
      .from("door_knocks")
      .select("id")
      .eq("neighborhood", territoryName)
      .eq("session_date", visitDate)
      .limit(1)
      .maybeSingle()

    if (existing) {
      await supabase.from("door_knocks").update({
        doors_knocked: knocked,
        doors_opened: opened,
        pitches_given: pitched,
        jobs_closed: closed,
        revenue_closed: revenue,
      }).eq("id", existing.id)
    } else {
      await supabase.from("door_knocks").insert({
        neighborhood: territoryName,
        session_date: visitDate,
        doors_knocked: knocked,
        doors_opened: opened,
        pitches_given: pitched,
        jobs_closed: closed,
        revenue_closed: revenue,
      })
    }
  } catch (syncErr) {
    console.error("[door-visit] door_knocks sync error:", syncErr)
    // Non-fatal — door was already saved successfully
  }

  return NextResponse.json({ door: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string; id: string }> },
) {
  const authed = await verifyCrmAuth()
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const supabase = getSupabase()

  const { error } = await supabase.from("territory_doors").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
