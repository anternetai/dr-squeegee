import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildVisitsFromPicks,
  generateVisitSchedule,
  isHighFrequencyPlan,
  type PlanService,
  type SchedulePick,
} from '@/lib/squeegee/plans'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface RouteParams {
  params: Promise<{ token: string }>
}

// Public endpoint — customer finishes portal onboarding.
// { picks: SchedulePick[] } builds their year from chosen months.
// { picks: [] } (or visits already exist) just marks onboarding complete.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const body = (await request.json()) as { picks?: SchedulePick[] }
    const picks = Array.isArray(body.picks) ? body.picks : []

    const supabase = getAdmin()
    const { data: plan, error } = await supabase
      .from('squeegee_plans')
      .select('*')
      .eq('portal_token', token)
      .single()

    if (error || !plan) {
      return NextResponse.json({ error: 'Portal link not found.' }, { status: 404 })
    }
    if (!plan.signed_at) {
      return NextResponse.json({ error: 'Please sign your agreement first.' }, { status: 400 })
    }
    if (plan.status === 'cancelled') {
      return NextResponse.json({ error: 'This plan is no longer active.' }, { status: 410 })
    }

    const { count } = await supabase
      .from('squeegee_plan_visits')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', plan.id)

    let visits: unknown[] = []
    const services = plan.services as PlanService[]

    // High-frequency plans (storefront routes, >12×/yr) skip month-picking —
    // build their day-spaced schedule automatically on onboarding completion.
    let effectiveBuild: { service_name: string; seq: number; scheduled_date: string }[] | null = null
    if (!count && picks.length === 0 && isHighFrequencyPlan(services)) {
      const termStartStr = plan.term_start || new Date().toISOString().slice(0, 10)
      effectiveBuild = generateVisitSchedule(services, new Date(termStartStr + 'T12:00:00'))
    }

    if (!count && (picks.length > 0 || effectiveBuild)) {
      const built = effectiveBuild ?? buildVisitsFromPicks(picks, services)
      if ('error' in built) {
        return NextResponse.json({ error: built.error }, { status: 400 })
      }

      const termStartStr = plan.term_start || new Date().toISOString().slice(0, 10)
      const termEnd = new Date(termStartStr + 'T12:00:00')
      termEnd.setFullYear(termEnd.getFullYear() + 1)

      const { data: inserted, error: insertErr } = await supabase
        .from('squeegee_plan_visits')
        .insert(built.map((v) => ({ ...v, plan_id: plan.id })))
        .select('*')

      if (insertErr) {
        return NextResponse.json({ error: 'Could not save your schedule. Please try again.' }, { status: 500 })
      }
      visits = inserted ?? []

      await supabase
        .from('squeegee_plans')
        .update({
          term_start: termStartStr,
          term_end: termEnd.toISOString().slice(0, 10),
          onboarded_at: new Date().toISOString(),
          schedule_prefs: picks,
        })
        .eq('id', plan.id)
    } else {
      // Visits already exist (or nothing to build) — just complete onboarding.
      await supabase
        .from('squeegee_plans')
        .update({ onboarded_at: new Date().toISOString(), ...(picks.length ? { schedule_prefs: picks } : {}) })
        .eq('id', plan.id)

      const { data: existing } = await supabase
        .from('squeegee_plan_visits')
        .select('*')
        .eq('plan_id', plan.id)
        .order('scheduled_date', { ascending: true })
      visits = existing ?? []
    }

    return NextResponse.json({ ok: true, visits })
  } catch (err) {
    console.error('Portal setup error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
