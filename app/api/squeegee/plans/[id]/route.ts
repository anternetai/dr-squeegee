import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCrmAuth } from '@/lib/crm-auth-check'
import { computePlanPricing, type PlanService } from '@/lib/squeegee/plans'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const supabase = getAdmin()

    const { data: plan, error } = await supabase
      .from('squeegee_plans')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const { data: visits } = await supabase
      .from('squeegee_plan_visits')
      .select('*')
      .eq('plan_id', id)
      .order('scheduled_date', { ascending: true })

    return NextResponse.json({ plan, visits: visits ?? [] })
  } catch (err) {
    console.error('Get plan error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface UpdatePlanBody {
  status?: string
  services?: PlanService[]
  billing?: 'paid_in_full' | 'monthly'
  discount_percent?: number
  term_start?: string | null
  term_end?: string | null
  notes?: string | null
  client_phone?: string | null
  client_email?: string | null
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const body = (await request.json()) as UpdatePlanBody
    const supabase = getAdmin()

    const { data: existing, error: fetchErr } = await supabase
      .from('squeegee_plans')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const update: Record<string, unknown> = {}

    if (body.status !== undefined) {
      if (!['draft', 'sent', 'signed', 'active', 'cancelled'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      update.status = body.status
    }

    // Signed plans keep their pricing/services locked — create a new plan instead
    // (same rule as signed quotes: never modify, revise).
    const priceFieldsTouched =
      body.services !== undefined || body.billing !== undefined || body.discount_percent !== undefined
    if (priceFieldsTouched) {
      if (existing.signed_at) {
        return NextResponse.json(
          { error: 'This plan is signed. Create a new plan to change services or pricing.' },
          { status: 400 }
        )
      }
      const services = (body.services ?? existing.services) as PlanService[]
      const billing = body.billing ?? existing.billing
      const discount = Number(body.discount_percent ?? existing.discount_percent)
      const { annualValue, pifTotal, monthlyPrice } = computePlanPricing(services, discount)
      update.services = services
      update.billing = billing
      update.discount_percent = discount
      update.annual_value = annualValue
      update.monthly_price = monthlyPrice
      update.total_price = billing === 'paid_in_full' ? pifTotal : annualValue
    }

    if (body.term_start !== undefined) update.term_start = body.term_start
    if (body.term_end !== undefined) update.term_end = body.term_end
    if (body.notes !== undefined) update.notes = body.notes
    if (body.client_phone !== undefined) update.client_phone = body.client_phone
    if (body.client_email !== undefined) update.client_email = body.client_email

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('squeegee_plans')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ plan: data })
  } catch (err) {
    console.error('Update plan error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const supabase = getAdmin()

    const { data: existing } = await supabase
      .from('squeegee_plans')
      .select('signed_at')
      .eq('id', id)
      .single()

    if (existing?.signed_at) {
      return NextResponse.json(
        { error: 'Signed plans cannot be deleted. Cancel it instead.' },
        { status: 400 }
      )
    }

    const { error } = await supabase.from('squeegee_plans').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Delete plan error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
