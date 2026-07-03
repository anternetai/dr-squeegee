import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCrmAuth } from '@/lib/crm-auth-check'
import { generateVisitSchedule, type PlanService } from '@/lib/squeegee/plans'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST { action: "generate", term_start? } → build the year's visit schedule
// POST { action: "add", service_name, scheduled_date } → add a single visit
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const body = await request.json()
    const supabase = getAdmin()

    const { data: plan, error: planErr } = await supabase
      .from('squeegee_plans')
      .select('*')
      .eq('id', id)
      .single()

    if (planErr || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (body.action === 'add') {
      const { service_name, scheduled_date } = body
      if (!service_name) {
        return NextResponse.json({ error: 'service_name is required' }, { status: 400 })
      }
      const { data, error } = await supabase
        .from('squeegee_plan_visits')
        .insert({ plan_id: id, service_name, scheduled_date: scheduled_date || null })
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ visit: data })
    }

    // Default: generate full schedule (replaces any non-completed visits)
    const termStartStr: string = body.term_start || plan.term_start || new Date().toISOString().slice(0, 10)
    const termStart = new Date(termStartStr + 'T12:00:00')
    const termEnd = new Date(termStart)
    termEnd.setFullYear(termEnd.getFullYear() + 1)

    const schedule = generateVisitSchedule(plan.services as PlanService[], termStart)
    if (schedule.length === 0) {
      return NextResponse.json({ error: 'Plan has no services' }, { status: 400 })
    }

    // Clear existing not-yet-completed visits so regeneration is idempotent
    await supabase
      .from('squeegee_plan_visits')
      .delete()
      .eq('plan_id', id)
      .neq('status', 'completed')

    const { data: visits, error } = await supabase
      .from('squeegee_plan_visits')
      .insert(schedule.map((v) => ({ ...v, plan_id: id })))
      .select('*')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase
      .from('squeegee_plans')
      .update({
        term_start: termStartStr,
        term_end: termEnd.toISOString().slice(0, 10),
      })
      .eq('id', id)

    return NextResponse.json({ visits })
  } catch (err) {
    console.error('Plan visits error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
