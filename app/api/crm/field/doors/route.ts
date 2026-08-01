import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyCrmAuth } from "@/lib/crm-auth-check"
import { linkDoorToCrm, NoContactError } from "@/lib/crm/field/link-to-crm"
import type { DoorVisit } from "@/lib/crm/field/types"

/* Field module — logging a door from inside the CRM.
   Unlike the standalone repo's HTTP bridge this runs in-process, so a close
   creates the client and job in the same request that saves the visit. No
   shared secret, no network hop, no silent best-effort failure. */

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Body {
  /** Omit to create a new door; supply to append a visit to an existing one. */
  doorId?: string
  territoryId: string
  lat: number
  lng: number
  visit: DoorVisit
  contactName?: string | null
  contactPhone?: string | null
  contactAddress?: string | null
}

const ALLOWED_VISIT_KEYS = [
  "date", "time", "answered", "pitched", "closed", "not_interested",
  "notes", "revenue", "photo", "audioUrl",
] as const

/** Explicit allowlist — never spread client JSON straight into the column. */
function cleanVisit(raw: Partial<DoorVisit> | undefined): DoorVisit {
  const src = raw ?? {}
  const out: Record<string, unknown> = {}
  for (const k of ALLOWED_VISIT_KEYS) {
    if (src[k] !== undefined) out[k] = src[k]
  }
  return {
    ...out,
    // Both are non-optional on DoorVisit; a malformed body must not produce a
    // row that later crashes the map's state derivation.
    date: typeof src.date === "string" && src.date ? src.date : new Date().toISOString().split("T")[0],
    answered: Boolean(src.answered),
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Body
    const { doorId, territoryId, lat, lng, contactName, contactPhone, contactAddress } = body

    if (!territoryId || typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "territoryId, lat and lng are required" },
        { status: 400 }
      )
    }

    const visit = cleanVisit(body.visit)
    const supabase = getAdmin()

    // A close with no way to contact the customer is the exact failure that
    // left $2,725 of door revenue with no customer record. Refuse it here so
    // the rule holds even if a future UI forgets to ask.
    if (visit.closed && !contactName?.trim() && !contactPhone?.trim()) {
      return NextResponse.json(
        { error: "A name or phone is required to log a close." },
        { status: 400 }
      )
    }

    // user_id is NOT NULL on doors_territory_doors. The standalone Doors app
    // fills it from the signed-in Supabase user; the CRM is gated by the
    // crm_auth cookie and has no Supabase identity, so a door inherits its
    // territory's owner — which is what it means for a door to be in a
    // territory anyway.
    const { data: territory } = await supabase
      .from("territories")
      .select("id, name, user_id")
      .eq("id", territoryId)
      .maybeSingle()

    if (!territory) {
      return NextResponse.json({ error: "Territory not found" }, { status: 404 })
    }

    const status = visit.not_interested
      ? "not_interested"
      : visit.closed
        ? "closed"
        : visit.pitched
          ? "pitched"
          : visit.answered
            ? "answered"
            : "not_home"

    let door: { id: string; visits: DoorVisit[]; crm_client_id: string | null }

    if (doorId) {
      const { data: existing, error } = await supabase
        .from("doors_territory_doors")
        .select("id, visits, crm_client_id, contact_name, contact_phone, contact_address")
        .eq("id", doorId)
        .maybeSingle()
      if (error || !existing) {
        return NextResponse.json({ error: "Door not found" }, { status: 404 })
      }

      const visits = [...(Array.isArray(existing.visits) ? existing.visits : []), visit]
      const { data: updated, error: updErr } = await supabase
        .from("doors_territory_doors")
        .update({
          visits,
          status,
          total_visits: visits.length,
          // A revisit that captures nothing must not wipe what an earlier
          // visit captured — only overwrite when the rep supplied a value.
          contact_name: contactName?.trim() || existing.contact_name || null,
          contact_phone: contactPhone?.trim() || existing.contact_phone || null,
          contact_address: contactAddress?.trim() || existing.contact_address || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", doorId)
        .select("id, visits, crm_client_id")
        .single()
      if (updErr) throw new Error(updErr.message)
      door = updated as typeof door
    } else {
      const { data: created, error } = await supabase
        .from("doors_territory_doors")
        .insert({
          territory_id: territoryId,
          user_id: territory.user_id,
          lat,
          lng,
          visits: [visit],
          status,
          total_visits: 1,
          contact_name: contactName?.trim() || null,
          contact_phone: contactPhone?.trim() || null,
          contact_address: contactAddress?.trim() || null,
        })
        .select("id, visits, crm_client_id")
        .single()
      if (error) throw new Error(error.message)
      door = created as typeof door
    }

    // Link into the CRM whenever a contact exists — not only on a close. A name
    // and number from a "come back Tuesday" is a lead worth keeping.
    let link: { client_id: string; job_id: string | null } | null = null
    const hasContact = Boolean(contactName?.trim() || contactPhone?.trim())

    if (hasContact && !door.crm_client_id) {
      try {
        link = await linkDoorToCrm(supabase, {
          contactName,
          contactPhone,
          contactAddress,
          territoryName: territory.name as string,
          doorId: door.id,
          closed: Boolean(visit.closed),
          revenue: visit.revenue ?? null,
          notes: visit.notes ?? null,
        })
        await supabase
          .from("doors_territory_doors")
          .update({ crm_client_id: link.client_id, crm_job_id: link.job_id })
          .eq("id", door.id)
      } catch (err) {
        if (err instanceof NoContactError) {
          // Unreachable given hasContact, but keep the door save intact.
        } else {
          console.error("[field/doors] CRM link failed:", err)
          return NextResponse.json(
            { doorId: door.id, linked: null, warning: "Door saved, but the CRM link failed." },
            { status: 207 }
          )
        }
      }
    }

    return NextResponse.json({
      doorId: door.id,
      status,
      linked: link ?? (door.crm_client_id ? { client_id: door.crm_client_id, job_id: null } : null),
    })
  } catch (err) {
    console.error("[field/doors] error:", err)
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
