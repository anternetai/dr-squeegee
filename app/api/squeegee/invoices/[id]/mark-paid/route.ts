import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyCrmAuth } from '@/lib/crm-auth-check'
import { sendReceiptForInvoice } from '@/lib/squeegee/send-receipt'
import { smsReviewOnce } from '@/lib/squeegee/sms-events'

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
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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

    // Cash, check and Zelle get the same treatment a card payment gets: the
    // customer receives a receipt, and the review ask goes out. Neither can
    // throw — the money is already collected, and a failed text must not turn
    // a successful mark-paid into an error on Anthony's screen.
    const receipt = await sendReceiptForInvoice(id).catch((err) => {
      console.error('Receipt send threw:', err)
      return { ok: false, reason: 'send error' as const, receiptUrl: undefined }
    })

    let reviewNote = ''
    if (invoice.job_id && process.env.GOOGLE_REVIEW_URL) {
      const { data: job } = await supabase
        .from('squeegee_jobs')
        .select('client_name, client_phone')
        .eq('id', invoice.job_id)
        .maybeSingle()
      if (job?.client_name) {
        const r = await smsReviewOnce({
          jobId: invoice.job_id,
          name: job.client_name as string,
          phone: (job.client_phone as string | null) ?? null,
        }).catch(() => null)
        reviewNote = r === null ? ' Review ask: already asked.' : r.sent ? ' Review ask sent.' : ` Review ask NOT sent (${r.reason}).`
      }
    }

    if (process.env.SLACK_BOT_TOKEN) {
      const receiptNote = receipt.ok
        ? ` Receipt sent — ${receipt.receiptUrl}`
        : ` ⚠️ Receipt NOT sent (${receipt.reason ?? 'unknown'}).`
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
        body: JSON.stringify({
          channel: 'U0ABZDLENJ1',
          text: `💵 Invoice ${invoice.invoice_number} marked paid${paymentMethod ? ` (${paymentMethod})` : ''}.${receiptNote}${reviewNote}`,
        }),
      }).catch((e) => console.error('mark-paid Slack post failed:', e))
    }

    return NextResponse.json({ ...invoice, receipt_sent: receipt.ok, receipt_url: receipt.receiptUrl ?? null })
  } catch (err) {
    console.error('Mark paid error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
