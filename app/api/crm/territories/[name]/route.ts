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

interface Recommendation {
  type: "warning" | "info" | "success"
  title: string
  message: string
}

function computeDetailedKpis(doors: TerritoryDoor[]) {
  const allVisits: DoorVisit[] = doors.flatMap((d) => (d.visits as DoorVisit[]) ?? [])

  const total_doors = doors.length
  const doors_answered = doors.filter((d) =>
    (d.visits as DoorVisit[])?.some((v) => v.answered),
  ).length
  const doors_pitched = doors.filter((d) =>
    (d.visits as DoorVisit[])?.some((v) => v.pitched),
  ).length
  const doors_closed = doors.filter((d) =>
    (d.visits as DoorVisit[])?.some((v) => v.closed),
  ).length
  const doors_not_interested = doors.filter((d) =>
    (d.visits as DoorVisit[])?.some((v) => v.not_interested),
  ).length

  const total_revenue = allVisits
    .filter((v) => v.closed && v.revenue)
    .reduce((sum, v) => sum + (v.revenue ?? 0), 0)

  const contact_rate = total_doors > 0 ? doors_answered / total_doors : 0
  const pitch_rate = doors_answered > 0 ? doors_pitched / doors_answered : 0
  const close_rate = doors_pitched > 0 ? doors_closed / doors_pitched : 0
  const avg_revenue_per_door = total_doors > 0 ? total_revenue / total_doors : 0
  const avg_ticket_size = doors_closed > 0 ? total_revenue / doors_closed : 0

  // Last knocked: most recent visit date across all doors
  const allDates = allVisits.map((v) => v.date).filter(Boolean)
  const last_knocked = allDates.length > 0 ? allDates.sort().at(-1) ?? null : null

  return {
    total_doors,
    doors_answered,
    doors_pitched,
    doors_closed,
    doors_not_interested,
    contact_rate,
    pitch_rate,
    close_rate,
    total_revenue,
    avg_revenue_per_door,
    avg_ticket_size,
    last_knocked,
  }
}

function buildRecommendations(kpis: ReturnType<typeof computeDetailedKpis>): Recommendation[] {
  const recs: Recommendation[] = []
  const { contact_rate, pitch_rate, close_rate, avg_revenue_per_door, total_doors } = kpis

  // Need at least 10 doors before insights are meaningful
  if (total_doors < 10) {
    if (total_doors > 0) {
      recs.push({
        type: "info",
        title: "Keep Knocking",
        message: `${total_doors} door${total_doors !== 1 ? "s" : ""} logged so far. Hit 10+ for meaningful insights.`,
      })
    }
    return recs
  }

  if (contact_rate < 0.15) {
    recs.push({
      type: "warning",
      title: "Territory Saturated",
      message: "Contact rate is very low. Consider moving to a fresh neighborhood.",
    })
  } else if (contact_rate < 0.2) {
    recs.push({
      type: "info",
      title: "Try Different Times",
      message: "Best door knocking hours are 4-7pm weekdays and 10am-4pm Saturdays.",
    })
  }

  if (pitch_rate < 0.5) {
    recs.push({
      type: "warning",
      title: "Improve Your Opener",
      message: "You're not getting to pitch enough contacts. Work on your first 10 seconds.",
    })
  }

  if (close_rate < 0.1) {
    recs.push({
      type: "warning",
      title: "Refine Your Pitch",
      message:
        "Close rate is below average. Try leading with a specific price or special offer.",
    })
  } else if (close_rate > 0.25) {
    recs.push({
      type: "success",
      title: "Crushing It",
      message:
        "Your close rate is elite. Look for similar neighborhoods to expand into.",
    })
  }

  if (avg_revenue_per_door < 5) {
    recs.push({
      type: "info",
      title: "Low Efficiency",
      message: "Revenue per door knocked is low. Focus on higher-value properties.",
    })
  }

  if (total_doors > 100 && contact_rate < 0.2) {
    recs.push({
      type: "warning",
      title: "Move On",
      message:
        "You've knocked 100+ doors with declining returns. Time for a new territory.",
    })
  }

  return recs
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const authed = await verifyCrmAuth()
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name } = await params
  const territoryName = decodeURIComponent(name)

  const supabase = getSupabase()

  const { data: territory, error: nhError } = await supabase
    .from("door_knock_neighborhoods")
    .select("*")
    .eq("name", territoryName)
    .single()

  if (nhError || !territory) {
    return NextResponse.json({ error: "Territory not found" }, { status: 404 })
  }

  const { data: doors, error: doorsError } = await supabase
    .from("territory_doors")
    .select("*")
    .eq("neighborhood", territoryName)
    .order("created_at", { ascending: true })

  if (doorsError) {
    return NextResponse.json({ error: doorsError.message }, { status: 500 })
  }

  const kpis = computeDetailedKpis((doors ?? []) as TerritoryDoor[])
  const recommendations = buildRecommendations(kpis)

  return NextResponse.json({
    territory: {
      id: territory.id,
      name: territory.name,
      address: territory.address ?? null,
      center_lat: territory.center_lat,
      center_lng: territory.center_lng,
      zoom_level: territory.zoom_level ?? 17,
      created_at: territory.created_at,
    },
    doors: doors ?? [],
    kpis,
    recommendations,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const authed = await verifyCrmAuth()
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name } = await params
  const territoryName = decodeURIComponent(name)

  const body = await req.json()
  const { center_lat, center_lng, zoom_level, new_name, address } = body as {
    center_lat?: number
    center_lng?: number
    zoom_level?: number
    new_name?: string
    address?: string
  }

  const updates: Record<string, unknown> = {}
  if (center_lat !== undefined) updates.center_lat = center_lat
  if (center_lng !== undefined) updates.center_lng = center_lng
  if (zoom_level !== undefined) updates.zoom_level = zoom_level
  if (new_name !== undefined) updates.name = new_name
  if (address !== undefined) updates.address = address

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const supabase = getSupabase()

  // If renaming, also update territory_doors that reference the old name
  if (new_name && new_name !== territoryName) {
    const { error: doorsUpdateError } = await supabase
      .from("territory_doors")
      .update({ neighborhood: new_name })
      .eq("neighborhood", territoryName)

    if (doorsUpdateError) {
      return NextResponse.json(
        { error: `Failed to update doors: ${doorsUpdateError.message}` },
        { status: 500 },
      )
    }
  }

  const { data, error } = await supabase
    .from("door_knock_neighborhoods")
    .update(updates)
    .eq("name", territoryName)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ territory: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const authed = await verifyCrmAuth()
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name } = await params
  const territoryName = decodeURIComponent(name)
  const supabase = getSupabase()

  // Delete all doors in this territory first
  const { error: doorsDeleteError } = await supabase
    .from("territory_doors")
    .delete()
    .eq("neighborhood", territoryName)

  if (doorsDeleteError) {
    return NextResponse.json(
      { error: `Failed to delete doors: ${doorsDeleteError.message}` },
      { status: 500 },
    )
  }

  // Delete the territory
  const { error } = await supabase
    .from("door_knock_neighborhoods")
    .delete()
    .eq("name", territoryName)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
