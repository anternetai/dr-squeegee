import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCrmAuth } from '@/lib/crm-auth-check'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface RouteParams {
  params: Promise<{ id: string; visitId: string }>
}

interface UpdateVisitBody {
  scheduled_date?: string
  status?: string
  notes?: string | null
  approve_reschedule?: boolean
  decline_reschedule?: boolean
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id, visitId } = await params
    const body = (await request.json()) as UpdateVisitBody
    const supabase = getAdmin()

    const { data: visit, error: fetchErr } = await supabase
      .from('squeegee_plan_visits')
      .select('*')
      .eq('id', visitId)
      .eq('plan_id', id)
      .single()

    if (fetchErr || !visit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    const update: Record<string, unknown> = {}

    if (body.approve_reschedule) {
      if (!visit.reschedule_requested_date) {
        return NextResponse.json({ error: 'No reschedule request on this visit' }, { status: 400 })
      }
      update.scheduled_date = visit.reschedule_requested_date
      update.status = 'scheduled'
      update.reschedule_requested_date = null
      update.reschedule_note = null
    } else if (body.decline_reschedule) {
      update.status = 'scheduled'
      update.reschedule_requested_date = null
      update.reschedule_note = null
    } else {
      if (body.scheduled_date !== undefined) {
        update.scheduled_date = body.scheduled_date
        update.status = 'scheduled'
        update.reschedule_requested_date = null
        update.reschedule_note = null
      }
      if (body.status !== undefined) {
        if (!['scheduled', 'reschedule_requested', 'completed', 'skipped'].includes(body.status)) {
          return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }
        update.status = body.status
      }
      if (body.notes !== undefined) update.notes = body.notes
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('squeegee_plan_visits')
      .update(update)
      .eq('id', visitId)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ visit: data })
  } catch (err) {
    console.error('Update visit error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id, visitId } = await params
    const supabase = getAdmin()

    const { error } = await supabase
      .from('squeegee_plan_visits')
      .delete()
      .eq('id', visitId)
      .eq('plan_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete visit error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
