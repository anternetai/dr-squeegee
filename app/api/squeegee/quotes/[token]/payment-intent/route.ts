import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

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

// PaymentIntent statuses that are still open for the customer to pay/re-pay.
const OPEN_PI_STATUSES = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = (await request.json().catch(() => ({}))) as { tip_amount?: unknown }

    const supabase = getAdmin()

    // 1. Quote must exist and be accepted.
    const { data: quote, error: quoteError } = await supabase
      .from('squeegee_quotes')
      .select('id, job_id, status, total_price')
      .eq('token', token)
      .single()

    if (quoteError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }
    if (quote.status !== 'accepted') {
      return NextResponse.json({ error: 'Quote is not accepted' }, { status: 409 })
    }

    // 2. Linked invoice must exist and be unpaid.
    const { data: invoice, error: invoiceError } = await supabase
      .from('squeegee_invoices')
      .select('id, invoice_number, amount, status, stripe_payment_intent_id, job_id')
      .eq('quote_id', quote.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 409 })
    }
    if (invoice.status === 'paid') {
      return NextResponse.json({ alreadyPaid: true })
    }

    // 3. Validate the tip. Server is authoritative on the charged amount —
    // never trust a client-computed total.
    const serviceTotal = Number(invoice.amount)
    const cap = Math.min(serviceTotal, 500)
    let tip = Number(body.tip_amount)
    if (!Number.isFinite(tip) || tip < 0) tip = 0
    if (tip > cap) tip = cap
    tip = Math.round(tip * 100) / 100

    const amountCents = Math.round((serviceTotal + tip) * 100)

    const metadata: Record<string, string> = {
      invoice_id: invoice.id,
      quote_id: quote.id,
      job_id: invoice.job_id ?? quote.job_id ?? '',
      invoice_number: invoice.invoice_number,
      tip_amount: tip.toFixed(2),
    }

    const stripe = getStripe()
    let paymentIntent: Stripe.PaymentIntent | null = null

    // 5. Idempotent: reuse an open PI on the invoice; only mint a new one if
    // there's none or the existing one is no longer payable.
    if (invoice.stripe_payment_intent_id) {
      try {
        const existing = await stripe.paymentIntents.retrieve(
          invoice.stripe_payment_intent_id
        )
        if (existing.status === 'succeeded' || existing.status === 'processing') {
          return NextResponse.json({ alreadyPaid: true })
        }
        if (OPEN_PI_STATUSES.has(existing.status)) {
          paymentIntent = await stripe.paymentIntents.update(existing.id, {
            amount: amountCents,
            metadata,
          })
        }
      } catch (err) {
        console.error('Stale PaymentIntent retrieve failed, creating a new one:', err)
      }
    }

    if (!paymentIntent) {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata,
      })
    }

    // Persist the PI id + current tip so the webhook can reconcile authoritatively.
    await supabase
      .from('squeegee_invoices')
      .update({ stripe_payment_intent_id: paymentIntent.id, tip_amount: tip })
      .eq('id', invoice.id)

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount: amountCents,
    })
  } catch (err) {
    console.error('Create payment intent error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
