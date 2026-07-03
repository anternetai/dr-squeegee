import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCrmAuth } from '@/lib/crm-auth-check'
import {
  computePlanPricing,
  DEFAULT_PIF_DISCOUNT,
  type PlanBilling,
  type PlanService,
} from '@/lib/squeegee/plans'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface CreatePlanBody {
  client_id?: string
  client_name: string
  client_phone?: string
  client_email?: string
  address: string
  plan_name?: string
  services: PlanService[]
  billing?: PlanBilling
  discount_percent?: number
  term_start?: string
  notes?: string
}

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = (await request.json()) as CreatePlanBody
    const { client_id, client_name, client_phone, client_email, address, plan_name, services, billing, term_start, notes } = body

    if (!client_name || !address || !services || services.length === 0) {
      return NextResponse.json(
        { error: 'client_name, address, and services are required' },
        { status: 400 }
      )
    }

    const discount = Number(body.discount_percent ?? DEFAULT_PIF_DISCOUNT)
    const { annualValue, pifTotal, monthlyPrice } = computePlanPricing(services, discount)
    const planBilling: PlanBilling = billing === 'monthly' ? 'monthly' : 'paid_in_full'
    const totalPrice = planBilling === 'paid_in_full' ? pifTotal : annualValue

    const supabase = getAdmin()
    const { data, error } = await supabase
      .from('squeegee_plans')
      .insert({
        client_id: client_id ?? null,
        client_name,
        client_phone: client_phone ?? null,
        client_email: client_email ?? null,
        address,
        plan_name: plan_name || 'Annual Exterior Care Plan',
        services,
        annual_value: annualValue,
        billing: planBilling,
        discount_percent: discount,
        total_price: totalPrice,
        monthly_price: monthlyPrice,
        term_start: term_start || null,
        notes: notes ?? null,
      })
      .select('id, token, portal_token')
      .single()

    if (error) {
      console.error('Plan insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plan: data })
  } catch (err) {
    console.error('Create plan error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = getAdmin()
    const { data, error } = await supabase
      .from('squeegee_plans')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('List plans error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
