import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCrmAuth } from '@/lib/crm-auth-check'
import { createQuote, type CreateQuoteInput } from '@/lib/squeegee/create-quote'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = (await request.json()) as CreateQuoteInput

    const supabase = getAdmin()
    const { quote, error } = await createQuote(supabase, body)

    if (error) {
      if (error === 'client_name, address, and services are required') {
        return NextResponse.json({ error }, { status: 400 })
      }
      console.error('Quote insert error:', error)
      return NextResponse.json({ error }, { status: 500 })
    }

    return NextResponse.json({ quote })
  } catch (err) {
    console.error('Create quote error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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
