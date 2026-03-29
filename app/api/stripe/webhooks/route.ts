import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.payment_status === 'paid') {
      const supabase = getAdmin()

      // Find invoice by matching the payment link URL
      // Payment links generate checkout sessions — match via payment_link ID
      const paymentLinkId = session.payment_link as string | null

      if (paymentLinkId) {
        // Fetch the payment link to get its URL
        const link = await getStripe().paymentLinks.retrieve(paymentLinkId)
        const linkUrl = link.url

        // Find the invoice with this payment link
        const { data: invoice } = await supabase
          .from('squeegee_invoices')
          .select('*')
          .eq('stripe_payment_link', linkUrl)
          .single()

        if (invoice) {
          // Mark invoice as paid
          await supabase
            .from('squeegee_invoices')
            .update({
              status: 'paid',
              stripe_payment_intent_id: session.payment_intent as string,
            })
            .eq('id', invoice.id)

          // Log activity
          if (invoice.job_id) {
            await supabase.from('squeegee_activity').insert({
              job_id: invoice.job_id,
              type: 'payment_received',
              note: `Payment received for invoice ${invoice.invoice_number} — $${Number(invoice.amount).toFixed(2)}`,
            })
          }

          // Notify via Slack
          await sendSlackNotification(
            `💵 *Payment Received!*\n*Invoice:* ${invoice.invoice_number}\n*Amount:* $${Number(invoice.amount).toFixed(2)}\n*Status:* Paid ✅`
          )
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
