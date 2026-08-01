// Bridges a door knock from the STANDALONE `doors` repo into the CRM.
//
// Since Doors folded into the CRM as a module (2026-07-31), the CRM's own
// field surface links doors in-process via app/api/crm/field/doors. This route
// remains the entry point for the separately-sold `doors` repo, and both now
// call the same lib/crm/field/link-to-crm implementation so the two paths
// cannot drift.
//
// Cross-app service call — shared-secret header, no CRM session exists.
import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { linkDoorToCrm, NoContactError } from "@/lib/crm/field/link-to-crm"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface FromDoorKnockBody {
  client_name?: string
  client_phone?: string
  address?: string
  territory_name: string
  door_id: string
  closed?: boolean
  revenue?: number
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.BRIDGE_SECRET
    if (!secret || request.headers.get("x-bridge-secret") !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as FromDoorKnockBody

    const result = await linkDoorToCrm(getAdmin(), {
      contactName: body.client_name,
      contactPhone: body.client_phone,
      contactAddress: body.address,
      territoryName: body.territory_name,
      doorId: body.door_id,
      closed: Boolean(body.closed),
      revenue: body.revenue ?? null,
      notes: body.notes ?? null,
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof NoContactError) {
      return NextResponse.json(
        { error: "client_name or client_phone is required" },
        { status: 400 }
      )
    }
    console.error("from-door-knock error:", err)
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
