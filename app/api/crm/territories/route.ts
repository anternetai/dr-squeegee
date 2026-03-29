import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyCrmAuth } from "@/lib/crm-auth-check"
import type { DoorVisit } from "@/lib/the-move/types"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function computeKpis(visits: DoorVisit[]) {
  const total_doors = visits.length
  const doors_answered = visits.filter((v) => v.answered).length
  const doors_pitched = visits.filter((v) => v.pitched).length
  const doors_closed = visits.filter((v) => v.closed).length
  const total_revenue = visits
    .filter((v) => v.closed && v.revenue)
    .reduce((sum, v) => sum + (v.revenue ?? 0), 0)

  const contact_rate = total_doors > 0 ? doors_answered / total_doors : 0
  const pitch_rate = doors_answered > 0 ? doors_pitched / doors_answered : 0
  const close_rate = doors_pitched > 0 ? doors_closed / doors_pitched : 0

  return {
    total_doors,
    doors_answered,
    doors_pitched,
    doors_closed,
    contact_rate,
    pitch_rate,
    close_rate,
    total_revenue,
  }
}

export async function GET() {
  const authed = await verifyCrmAuth()
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getSupabase()

  const { data: neighborhoods, error: nhError } = await supabase
    .from("door_knock_neighborhoods")
    .select("*")
    .order("created_at", { ascending: false })

  if (nhError) {
    return NextResponse.json({ error: nhError.message }, { status: 500 })
  }

  // For each territory, gather all door visits and compute KPIs
  const territories = await Promise.all(
    (neighborhoods ?? []).map(async (nh) => {
      const { data: doors } = await supabase
        .from("territory_doors")
        .select("visits")
        .eq("neighborhood", nh.name)

      // Flatten all visits across all doors for this territory
      const allVisits: DoorVisit[] = (doors ?? []).flatMap(
        (d) => (d.visits as DoorVisit[]) ?? [],
      )

      const kpis = computeKpis(allVisits)

      return {
        id: nh.id,
        name: nh.name,
        address: nh.address ?? null,
        center_lat: nh.center_lat,
        center_lng: nh.center_lng,
        zoom_level: nh.zoom_level ?? 17,
        created_at: nh.created_at,
        kpis,
      }
    }),
  )

  return NextResponse.json({ territories })
}

export async function POST(req: NextRequest) {
  const authed = await verifyCrmAuth()
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { name, address } = body as { name: string; address: string }

  if (!name || !address) {
    return NextResponse.json({ error: "name and address are required" }, { status: 400 })
  }

  // Geocode using OpenStreetMap Nominatim
  let center_lat: number | null = null
  let center_lng: number | null = null

  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "User-Agent": "DrSqueegee/1.0" } },
    )
    const geoData = await geoRes.json()
    if (Array.isArray(geoData) && geoData.length > 0) {
      center_lat = parseFloat(geoData[0].lat)
      center_lng = parseFloat(geoData[0].lon)
    }
  } catch (err) {
    console.error("[territories] Geocoding failed:", err)
    // Continue without coordinates — not a fatal error
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from("door_knock_neighborhoods")
    .insert({
      name,
      address,
      center_lat,
      center_lng,
      zoom_level: 17,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ territory: data }, { status: 201 })
}
