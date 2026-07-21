// Bridges a Doors-app door knock into the CRM: whenever a door log captures a
// contact (name/phone) — via components/door-log-overlay.tsx (dr-squeegee CRM
// note: this specific bridge target is called by the STANDALONE `doors` repo,
// not the CRM's own /crm/territories "the-move" feature) — upsert a
// squeegee_clients row, and on a close, create a squeegee_job too so the deal
// shows up in the CRM pipeline instead of only living in the Doors app.
//
// Mirrors /api/squeegee/from-field (the in-field quote-tool bridge): same
// app, same "no CRM session available, so no verifyCrmAuth() gate" shape —
// this is a cross-app service call, not a browser request from inside the CRM.
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
    // Cross-app bridge auth: shared secret header, no fail-open. Callers:
    // doors repo lib/crm-bridge.ts. Same secret gates from-field.
    const secret = process.env.BRIDGE_SECRET
    if (!secret || request.headers.get('x-bridge-secret') !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as FromDoorKnockBody
    const { client_name, client_phone, address, territory_name, door_id, closed, revenue, notes } = body

    if (!client_name?.trim() && !client_phone?.trim()) {
      return NextResponse.json({ error: 'client_name or client_phone is required' }, { status: 400 })
    }

    const supabase = getAdmin()
    const cleanPhone = client_phone?.replace(/\D/g, '') || null
    const name = client_name?.trim() || 'Door knock contact'

    // 1. Upsert client — match by phone, else create. (No email path here —
    // door knocks rarely capture one; falls back to name-only if no phone.)
    let client_id: string | null = null

    if (cleanPhone) {
      const { data: existing } = await supabase
        .from('squeegee_clients')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle()
      if (existing) client_id = existing.id
    }

    if (!client_id) {
      const { data: newClient, error: clientErr } = await supabase
        .from('squeegee_clients')
        .insert({
          name,
          phone: cleanPhone,
          email: null,
          address: address?.trim() || null,
          notes: `From door knock — ${territory_name} (door ${door_id})`,
        })
        .select('id')
        .single()
      if (clientErr) {
        console.error('from-door-knock client insert error:', clientErr)
        return NextResponse.json({ error: clientErr.message }, { status: 500 })
      }
      client_id = newClient.id
    }

    // 2. On a close, create a job too — the deal already happened in person,
    // no quote to send, so it starts at "approved" (price known, ready to
    // schedule) rather than "new"/"quoted".
    let job_id: string | null = null
    if (closed) {
      const { data: job, error: jobErr } = await supabase
        .from('squeegee_jobs')
        .insert({
          client_id,
          client_name: name,
          client_phone: cleanPhone,
          client_email: null,
          address: address?.trim() || 'Address not captured — see door knock notes',
          service_type: `Door-to-door — ${territory_name}`,
          status: 'approved',
          price: revenue != null ? Number(revenue) : null,
          notes: [`Closed via door knock in ${territory_name} (door ${door_id}).`, notes?.trim()]
            .filter(Boolean)
            .join(' '),
        })
        .select('id')
        .single()

      if (jobErr) {
        console.error('from-door-knock job insert error:', jobErr)
        // Client was still created successfully — return that much rather
        // than failing the whole bridge.
        return NextResponse.json({ client_id, job_id: null, error: jobErr.message })
      }
      job_id = job.id

      await supabase.from('squeegee_activity').insert({
        job_id,
        type: 'door_knock_close',
        note: `Created from a Doors app close in ${territory_name}${revenue ? ` — $${Number(revenue).toFixed(2)}` : ''}.`,
      })
    }

    return NextResponse.json({ client_id, job_id })
  } catch (err) {
    console.error('from-door-knock error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
