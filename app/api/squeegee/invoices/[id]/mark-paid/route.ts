import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getAdmin()

    // Parse optional payment_method from body
    let paymentMethod: string | null = null
    try {
      const body = await request.json()
      if (body.payment_method) paymentMethod = body.payment_method
    } catch {
      // No body is fine — defaults to null (Stripe webhook / legacy)
    }

    // Update invoice status to 'paid'
    const { data: invoice, error: updateError } = await supabase
      .from('squeegee_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        ...(paymentMethod ? { payment_method: paymentMethod } : {}),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Invoice mark-paid update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Update linked job status to 'complete'
    if (invoice.job_id) {
      const { error: jobError } = await supabase
        .from('squeegee_jobs')
        .update({ status: 'complete' })
        .eq('id', invoice.job_id)

      if (jobError) {
        console.error('Job status update error:', jobError)
        // Non-fatal — continue and still return the invoice
      }
    }

    // Log activity
    await supabase.from('squeegee_activity').insert({
      job_id: invoice.job_id,
      type: 'payment_received',
      note: `Invoice marked as paid - $${Number(invoice.amount).toFixed(2)}${paymentMethod ? ` (${paymentMethod})` : ''}`,
    })

    return NextResponse.json(invoice)
  } catch (err) {
    console.error('Mark paid error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
