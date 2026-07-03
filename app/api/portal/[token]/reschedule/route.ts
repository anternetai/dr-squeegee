import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { validateRescheduleRequest } from '@/lib/squeegee/plans'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface RouteParams {
  params: Promise<{ token: string }>
}

interface RescheduleBody {
  visit_id: string
  requested_date: string
  note?: string
}

// Public endpoint — member requests a new date for a visit from /portal/[token].
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const body = (await request.json()) as RescheduleBody
    const { visit_id, requested_date } = body
    const note = (body.note ?? '').slice(0, 500)

    if (!visit_id || !requested_date) {
      return NextResponse.json({ error: 'visit_id and requested_date are required.' }, { status: 400 })
    }

    const supabase = getAdmin()
    const { data: plan, error: planErr } = await supabase
      .from('squeegee_plans')
      .select('id, status')
      .eq('portal_token', token)
      .single()

    if (planErr || !plan) {
      return NextResponse.json({ error: 'Portal link not found.' }, { status: 404 })
    }
    if (plan.status === 'cancelled') {
      return NextResponse.json({ error: 'This plan is no longer active.' }, { status: 410 })
    }

    const { data: visit, error: visitErr } = await supabase
      .from('squeegee_plan_visits')
      .select('*')
      .eq('id', visit_id)
      .eq('plan_id', plan.id)
      .single()

    if (visitErr || !visit) {
      return NextResponse.json({ error: 'Visit not found.' }, { status: 404 })
    }
    if (visit.status === 'completed' || visit.status === 'skipped') {
      return NextResponse.json({ error: 'This visit can no longer be rescheduled.' }, { status: 400 })
    }
    if (!visit.scheduled_date) {
      return NextResponse.json({ error: 'This visit has no date yet — we’ll reach out to schedule it.' }, { status: 400 })
    }

    const check = validateRescheduleRequest(visit.scheduled_date, requested_date)
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('squeegee_plan_visits')
      .update({
        status: 'reschedule_requested',
        reschedule_requested_date: requested_date,
        reschedule_note: note || null,
      })
      .eq('id', visit_id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ visit: data })
  } catch (err) {
    console.error('Reschedule request error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
