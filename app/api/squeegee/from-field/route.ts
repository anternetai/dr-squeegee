import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Service {
  name: string
  price: number
  description?: string
}

interface FromFieldBody {
  client_name: string
  client_phone?: string
  client_email?: string
  address: string
  services: Service[]
  discount_type?: 'percent' | 'dollar' | null
  discount_value?: number
}

export async function POST(request: NextRequest) {
  try {
    // Cross-app bridge auth (closes the long-open unauth hole): shared secret
    // header, no fail-open. Caller: doors repo app/api/quote/route.ts.
    const secret = process.env.BRIDGE_SECRET
    if (!secret || request.headers.get('x-bridge-secret') !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as FromFieldBody
    const { client_name, client_phone, client_email, address, services, discount_type, discount_value } = body

    if (!client_name || !address || !services?.length) {
      return NextResponse.json(
        { error: 'client_name, address, and services are required' },
        { status: 400 }
      )
    }

    const supabase = getAdmin()
    const cleanPhone = client_phone?.replace(/\D/g, '') || null

    // 1. Upsert client — match by phone, then email, else insert
    let client_id: string | null = null

    if (cleanPhone) {
      const { data: existing } = await supabase
        .from('squeegee_clients')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle()
      if (existing) {
        client_id = existing.id
        await supabase.from('squeegee_clients').update({
          name: client_name,
          ...(client_email && { email: client_email }),
          address,
        }).eq('id', client_id)
      }
    }

    if (!client_id && client_email) {
      const { data: existing } = await supabase
        .from('squeegee_clients')
        .select('id')
        .eq('email', client_email)
        .maybeSingle()
      if (existing) client_id = existing.id
    }

    if (!client_id) {
      const { data: newClient, error: clientErr } = await supabase
        .from('squeegee_clients')
        .insert({ name: client_name, phone: cleanPhone, email: client_email ?? null, address })
        .select('id')
        .single()
      if (clientErr) {
        console.error('Client insert error:', clientErr)
        return NextResponse.json({ error: clientErr.message }, { status: 500 })
      }
      client_id = newClient.id
    }

    // 2. Calculate totals
    const subtotal = services.reduce((sum, s) => sum + Number(s.price), 0)
    const discountNum = Number(discount_value) || 0
    const discountAmount =
      discount_type === 'percent'
        ? Math.round(subtotal * (discountNum / 100) * 100) / 100
        : discountNum
    const total_price = Math.max(0, subtotal - discountAmount)
    const serviceNames = services.map((s) => s.name).join(', ')

    // 3. Create job
    const { data: job, error: jobErr } = await supabase
      .from('squeegee_jobs')
      .insert({
        client_id,
        client_name,
        client_phone: cleanPhone,
        client_email: client_email ?? null,
        address,
        service_type: serviceNames,
        status: 'quoted',
        price: total_price,
      })
      .select('id')
      .single()

    if (jobErr) {
      console.error('Job insert error:', jobErr)
      return NextResponse.json({ error: jobErr.message }, { status: 500 })
    }

    // 4. Create quote linked to job
    const { data: quote, error: quoteErr } = await supabase
      .from('squeegee_quotes')
      .insert({
        job_id: job.id,
        client_name,
        client_phone: cleanPhone,
        client_email: client_email ?? null,
        address,
        services,
        subtotal,
        discount_type: discount_type ?? null,
        discount_value: discountNum,
        total_price,
      })
      .select('id, token')
      .single()

    if (quoteErr) {
      console.error('Quote insert error:', quoteErr)
      return NextResponse.json({ error: quoteErr.message }, { status: 500 })
    }

    const crmBase = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.drsqueegeeclt.com'

    return NextResponse.json({
      token: quote.token,
      job_id: job.id,
      client_id,
      quote_url: `${crmBase}/q/${quote.token}`,
    })
  } catch (err) {
    console.error('from-field error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
