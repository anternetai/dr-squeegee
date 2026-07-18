import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { reviewAskLine } from '@/lib/squeegee/review-ask'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  })
}

async function sendSlackNotification(text: string) {
  if (!process.env.SLACK_BOT_TOKEN) return
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel: 'U0ABZDLENJ1',
      text,
    }),
  })
}

interface InvoiceRow {
  id: string
  invoice_number: string
  amount: number
  tip_amount: number | null
  status: string
  job_id: string | null
}

// Shared finalizer for a paid invoice. Idempotent — a second delivery of the
// same event (or a checkout + payment_intent pair for the same invoice) is a
// no-op once the invoice is already 'paid'.
async function markInvoicePaid(
  supabase: SupabaseClient,
  invoice: InvoiceRow,
  opts: { paymentIntentId: string | null; tip: number }
) {
  if (invoice.status === 'paid') return

  // The money is already captured in Stripe by the time this fires. If we can't
  // record it, don't send a "Paid ✅" confirmation on a still-unpaid invoice —
  // alert instead so it can be marked manually.
  const { error: paidError } = await supabase
    .from('squeegee_invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      payment_method: 'stripe',
      tip_amount: opts.tip,
      ...(opts.paymentIntentId ? { stripe_payment_intent_id: opts.paymentIntentId } : {}),
    })
    .eq('id', invoice.id)

  if (paidError) {
    console.error('Failed to mark invoice paid:', paidError)
    await sendSlackNotification(
      `⚠️ *Could not mark invoice ${invoice.invoice_number} paid* — payment WAS received in Stripe. Please mark it paid manually. Error: ${paidError.message}`
    )
    return
  }

  if (invoice.job_id) {
    await supabase.from('squeegee_jobs').update({ status: 'complete' }).eq('id', invoice.job_id)
  }

  const tipNote = opts.tip > 0 ? ` + $${opts.tip.toFixed(2)} tip` : ''
  await supabase.from('squeegee_activity').insert({
    job_id: invoice.job_id,
    type: 'payment_received',
    note: `Payment received for invoice ${invoice.invoice_number} — $${Number(invoice.amount).toFixed(2)}${tipNote}`,
  })

  const reviewAsk = await reviewAskLine(supabase, invoice.job_id)
  const tipLine = opts.tip > 0 ? `\n*Tip:* $${opts.tip.toFixed(2)}` : ''
  const grand = Number(invoice.amount) + opts.tip
  await sendSlackNotification(
    `💵 *Payment Received!*\n*Invoice:* ${invoice.invoice_number}\n*Service:* $${Number(invoice.amount).toFixed(2)}${tipLine}\n*Total paid:* $${grand.toFixed(2)}\n*Status:* Paid ✅${reviewAsk}`
  )
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  // Verify webhook signature — REQUIRED
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured — rejecting webhook')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getAdmin()

  // New embedded-checkout path: Payment Element confirms a PaymentIntent.
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    const invoiceId = pi.metadata?.invoice_id

    let invoice: InvoiceRow | null = null
    if (invoiceId) {
      const { data } = await supabase
        .from('squeegee_invoices')
        .select('id, invoice_number, amount, tip_amount, status, job_id')
        .eq('id', invoiceId)
        .maybeSingle()
      invoice = data as InvoiceRow | null
    }
    // Fallback: match by the PI id we persisted when creating the intent.
    if (!invoice) {
      const { data } = await supabase
        .from('squeegee_invoices')
        .select('id, invoice_number, amount, tip_amount, status, job_id')
        .eq('stripe_payment_intent_id', pi.id)
        .maybeSingle()
      invoice = data as InvoiceRow | null
    }

    if (invoice && invoice.status !== 'paid') {
      const metaTip = Number(pi.metadata?.tip_amount)
      const tip = Number.isFinite(metaTip) ? metaTip : Number(invoice.tip_amount) || 0
      const expectedCents = Math.round((Number(invoice.amount) + tip) * 100)

      // Amount-drift guard: the charged amount must match service + tip.
      if (pi.amount_received !== expectedCents) {
        await sendSlackNotification(
          `⚠️ *Payment amount mismatch* on invoice ${invoice.invoice_number}\n` +
            `Expected $${(expectedCents / 100).toFixed(2)}, Stripe received $${(pi.amount_received / 100).toFixed(2)}. ` +
            `Marking paid with the actual received amount — please review in Stripe.`
        )
      }

      const receivedTip = Math.max(0, pi.amount_received / 100 - Number(invoice.amount))
      await markInvoicePaid(supabase, invoice, {
        paymentIntentId: pi.id,
        tip: Math.round(receivedTip * 100) / 100,
      })
    }

    return NextResponse.json({ received: true })
  }

  // Legacy path: hosted Payment Links generate a checkout session.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.payment_status === 'paid') {
      const paymentLinkId = session.payment_link as string | null

      if (paymentLinkId) {
        const link = await getStripe().paymentLinks.retrieve(paymentLinkId)
        const linkUrl = link.url

        const { data } = await supabase
          .from('squeegee_invoices')
          .select('id, invoice_number, amount, tip_amount, status, job_id')
          .eq('stripe_payment_link', linkUrl)
          .maybeSingle()
        const invoice = data as InvoiceRow | null

        if (invoice && invoice.status !== 'paid') {
          // Hosted Payment Links carry a fixed service-only price and never
          // collect a tip, so ignore any tip staged on the invoice by an
          // abandoned embedded-checkout attempt.
          await markInvoicePaid(supabase, invoice, {
            paymentIntentId: session.payment_intent as string,
            tip: 0,
          })
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
