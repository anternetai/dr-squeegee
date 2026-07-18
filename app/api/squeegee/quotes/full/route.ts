// One-screen "New Quote" flow: client (upsert) → job → quote, in a single POST.
// Kills the create-client-then-create-job-then-quote-again dance. Reuses createQuote()
// (lib/squeegee/create-quote.ts) so the quote insert shape and job-flip-to-"quoted"
// side effect are identical to the existing per-job quote route.
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCrmAuth } from '@/lib/crm-auth-check'
import { createQuote, type QuoteServiceInput } from '@/lib/squeegee/create-quote'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface FullQuoteBody {
  client_id?: string | null
  client_name: string
  client_phone?: string | null
  client_email?: string | null
  address: string
  notes?: string | null
  services: QuoteServiceInput[]
  discount_type?: 'percent' | 'dollar' | null
  discount_value?: number
}

async function upsertClient(
  supabase: SupabaseClient,
  body: FullQuoteBody
): Promise<{ id: string; name: string; phone: string | null; email: string | null; address: string | null }> {
  // Explicit client_id (picked from the type-ahead) wins — no matching needed.
  if (body.client_id) {
    const { data } = await supabase
      .from('squeegee_clients')
      .select('id, name, phone, email, address')
      .eq('id', body.client_id)
      .single()
    if (data) return data
  }

  const phone = body.client_phone?.trim() || null
  const email = body.client_email?.trim() || null

  if (phone) {
    const { data } = await supabase
      .from('squeegee_clients')
      .select('id, name, phone, email, address')
      .eq('phone', phone)
      .maybeSingle()
    if (data) return data
  }

  if (email) {
    const { data } = await supabase
      .from('squeegee_clients')
      .select('id, name, phone, email, address')
      .eq('email', email)
      .maybeSingle()
    if (data) return data
  }

  const { data, error } = await supabase
    .from('squeegee_clients')
    .insert({
      name: body.client_name.trim(),
      phone,
      email,
      address: body.address?.trim() || null,
    })
    .select('id, name, phone, email, address')
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as FullQuoteBody
    const { client_name, address, services } = body

    if (!client_name?.trim() || !address?.trim()) {
      return NextResponse.json({ error: 'client_name and address are required' }, { status: 400 })
    }
    if (!services || services.length === 0) {
      return NextResponse.json({ error: 'At least one service line is required' }, { status: 400 })
    }

    const supabase = getAdmin()

    // 1. Upsert client (match by phone, else email, else create).
    const client = await upsertClient(supabase, body)

    // 2. Create the job row (ceremony collapsed into this one request).
    const serviceNames = services.map((s) => s.name).join(', ')
    const { data: job, error: jobError } = await supabase
      .from('squeegee_jobs')
      .insert({
        client_name: client.name,
        client_phone: client.phone,
        client_email: client.email,
        address: address.trim(),
        service_type: serviceNames || 'Pending Quote',
        notes: body.notes?.trim() || null,
        status: 'new',
        client_id: client.id,
      })
      .select('id')
      .single()

    if (jobError || !job) {
      console.error('Full-quote job insert error:', jobError)
      return NextResponse.json({ error: jobError?.message ?? 'Failed to create job' }, { status: 500 })
    }

    // 3. Create the quote — same function the old per-job route uses. This also
    // flips the job to "quoted" and sets its price/service_type.
    const { quote, error: quoteError } = await createQuote(supabase, {
      job_id: job.id,
      client_name: client.name,
      client_phone: client.phone,
      client_email: client.email,
      address: address.trim(),
      services,
      discount_type: body.discount_type ?? null,
      discount_value: body.discount_value ?? 0,
    })

    if (quoteError || !quote) {
      console.error('Full-quote quote insert error:', quoteError)
      return NextResponse.json({ error: quoteError ?? 'Failed to create quote' }, { status: 500 })
    }

    return NextResponse.json({
      token: quote.token,
      job_id: job.id,
      quote_url: `https://www.drsqueegeeclt.com/q/${quote.token}`,
    })
  } catch (err) {
    console.error('Full quote flow error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
