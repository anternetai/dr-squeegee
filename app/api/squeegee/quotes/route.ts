import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface QuoteService {
  name: string
  price: number
}

interface CreateQuoteBody {
  job_id?: string
  client_name: string
  client_phone?: string
  client_email?: string
  address: string
  services: QuoteService[]
  discount_type?: 'percent' | 'dollar' | null
  discount_value?: number
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateQuoteBody

    const { job_id, client_name, client_phone, client_email, address, services, discount_type, discount_value } = body

    if (!client_name || !address || !services || services.length === 0) {
      return NextResponse.json(
        { error: 'client_name, address, and services are required' },
        { status: 400 }
      )
    }

    const subtotal = services.reduce((sum, s) => sum + Number(s.price), 0)
    const discountVal = Number(discount_value) || 0
    const discountAmount = discount_type === 'percent'
      ? Math.round(subtotal * (discountVal / 100) * 100) / 100
      : discountVal
    const total_price = Math.max(0, subtotal - discountAmount)

    const supabase = getAdmin()

    const { data, error } = await supabase
      .from('squeegee_quotes')
      .insert({
        job_id: job_id ?? null,
        client_name,
        client_phone: client_phone ?? null,
        client_email: client_email ?? null,
        address,
        services,
        subtotal,
        discount_type: discount_type ?? null,
        discount_value: discountVal,
        total_price,
      })
      .select('id, token')
      .single()

    if (error) {
      console.error('Quote insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-update job status to "quoted" and set price/service info
    if (job_id) {
      const serviceNames = services.map((s) => s.name).join(', ')
      await supabase
        .from('squeegee_jobs')
        .update({
          status: 'quoted',
          price: total_price,
          service_type: serviceNames,
        })
        .eq('id', job_id)
    }

    return NextResponse.json({ quote: data })
  } catch (err) {
    console.error('Create quote error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const job_id = searchParams.get('job_id')

    if (!job_id) {
      return NextResponse.json({ error: 'job_id is required' }, { status: 400 })
    }

    const supabase = getAdmin()

    const { data, error } = await supabase
      .from('squeegee_quotes')
      .select('*')
      .eq('job_id', job_id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('Get quotes error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
