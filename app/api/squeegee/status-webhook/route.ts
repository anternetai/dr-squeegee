import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_id, old_status, new_status, client_name } = body

    if (!job_id || !old_status || !new_status) {
      return NextResponse.json(
        { error: 'job_id, old_status, and new_status are required' },
        { status: 400 }
      )
    }

    const supabase = getAdmin()

    const noteBase = `Status changed from ${old_status} to ${new_status}`
    const note = client_name ? `${noteBase} for ${client_name}` : noteBase

    const { error } = await supabase.from('squeegee_activity').insert({
      job_id,
      type: 'status_change',
      note,
    })

    if (error) {
      console.error('Status webhook activity log error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Status webhook error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
