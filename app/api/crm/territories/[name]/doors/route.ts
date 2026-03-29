import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyCrmAuth } from "@/lib/crm-auth-check"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
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

  const { data, error } = await supabase
    .from("territory_doors")
    .select("*")
    .eq("neighborhood", territoryName)
    .order("created_at", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ doors: data ?? [] })
}

export async function POST(
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
  const { lat, lng } = body as { lat: number; lng: number }

  if (lat === undefined || lng === undefined) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from("territory_doors")
    .insert({
      neighborhood: territoryName,
      lat,
      lng,
      visits: [],
      status: "not_home",
      total_visits: 0,
      notes: null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ door: data }, { status: 201 })
}
