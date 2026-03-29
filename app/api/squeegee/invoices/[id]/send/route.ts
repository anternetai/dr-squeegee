import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getAdmin()

    // Update invoice status to 'sent'
    const { data: invoice, error: updateError } = await supabase
      .from('squeegee_invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Invoice send update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Log activity
    await supabase.from('squeegee_activity').insert({
      job_id: invoice.job_id,
      type: 'invoice_sent',
      note: 'Invoice sent to client',
    })

    return NextResponse.json(invoice)
  } catch (err) {
    console.error('Send invoice error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
