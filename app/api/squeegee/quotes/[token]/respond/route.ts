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

type QuoteAction = 'accepted' | 'declined' | 'help'

interface QuoteService {
  name: string
  price: number
}

interface SqueegeeQuote {
  id: string
  token: string
  job_id: string | null
  client_name: string
  client_phone: string | null
  client_email: string | null
  address: string
  services: QuoteService[]
  total_price: number
  status: string
  client_response_at: string | null
  created_at: string
}

const ACTION_EMOJI: Record<QuoteAction, string> = {
  accepted: '✅',
  declined: '❌',
  help: '💬',
}

const ACTION_LABEL: Record<QuoteAction, string> = {
  accepted: 'Quote Accepted!',
  declined: 'Quote Declined',
  help: 'Client Has Questions',
}

async function createInvoiceForQuote(quote: SqueegeeQuote) {
  const supabase = getAdmin()
  const stripe = getStripe()

  // Generate invoice number
  const { count } = await supabase
    .from('squeegee_invoices')
    .select('*', { count: 'exact', head: true })
  const sequence = (count ?? 0) + 1001
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`

  // Create Stripe Payment Link
  const amountInCents = Math.round(Number(quote.total_price) * 100)
  const serviceNames = quote.services.map((s) => s.name).join(', ')
  const stripePrice = await stripe.prices.create({
    currency: 'usd',
    unit_amount: amountInCents,
    product_data: { name: `Dr. Squeegee - ${serviceNames}` },
  })
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: stripePrice.id, quantity: 1 }],
    metadata: {
      quote_id: quote.id,
      job_id: quote.job_id ?? '',
      client_name: quote.client_name,
    },
  })

  // Due in 7 days
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 7)

  // Save invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('squeegee_invoices')
    .insert({
      job_id: quote.job_id,
      invoice_number: invoiceNumber,
      amount: Number(quote.total_price),
      due_date: dueDate.toISOString().split('T')[0],
      notes: `Auto-generated from accepted quote. Services: ${serviceNames}`,
      status: 'sent',
      stripe_payment_link: paymentLink.url,
    })
    .select()
    .single()

  if (invoiceError) {
    console.error('Auto-invoice creation failed:', invoiceError)
    return null
  }

  // Log activity
  if (quote.job_id) {
    await supabase.from('squeegee_activity').insert({
      job_id: quote.job_id,
      type: 'invoice_created',
      note: `Invoice ${invoiceNumber} auto-generated for $${Number(quote.total_price).toFixed(2)}`,
    })
  }

  return { invoiceNumber, paymentUrl: paymentLink.url }
}

async function sendSlackNotification(
  quote: SqueegeeQuote,
  action: QuoteAction,
  invoiceInfo?: { invoiceNumber: string; paymentUrl: string } | null
) {
  const services = Array.isArray(quote.services) ? quote.services : []
  const serviceNames = services.map((s: QuoteService) => s.name).join(', ')
  const emoji = ACTION_EMOJI[action]
  const label = ACTION_LABEL[action]

  let text = `${emoji} *${label}*\n*Client:* ${quote.client_name}\n*Address:* ${quote.address}\n*Services:* ${serviceNames}\n*Total:* $${Number(quote.total_price).toFixed(2)}`

  if (action === 'accepted') {
    text += `\n\nText them to confirm: ${quote.client_phone ?? 'N/A'}`
    if (invoiceInfo) {
      text += `\n\n💰 *Invoice ${invoiceInfo.invoiceNumber} auto-created*\nPayment link: ${invoiceInfo.paymentUrl}`
    }
  } else if (action === 'help') {
    text += `\n\nThey have questions — reach out: ${quote.client_phone ?? 'N/A'}`
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
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

  const result = await response.json() as { ok: boolean; error?: string }
  if (!result.ok) {
    console.error('Slack notification failed:', result.error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = (await request.json()) as { action: QuoteAction }
    const { action } = body

    if (!['accepted', 'declined', 'help'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const supabase = getAdmin()

    // Fetch quote first
    const { data: quote, error: fetchError } = await supabase
      .from('squeegee_quotes')
      .select('*')
      .eq('token', token)
      .single()

    if (fetchError || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Update quote status
    const { error: updateError } = await supabase
      .from('squeegee_quotes')
      .update({
        status: action,
        client_response_at: new Date().toISOString(),
      })
      .eq('token', token)

    if (updateError) {
      console.error('Quote update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const typedQuote = quote as SqueegeeQuote

    // Auto-update job status based on response
    if (typedQuote.job_id) {
      if (action === 'accepted') {
        await supabase
          .from('squeegee_jobs')
          .update({ status: 'approved' })
          .eq('id', typedQuote.job_id)
      } else if (action === 'declined') {
        await supabase
          .from('squeegee_jobs')
          .update({ status: 'new' })
          .eq('id', typedQuote.job_id)
      }
    }

    // Auto-generate invoice when accepted
    let invoiceInfo: { invoiceNumber: string; paymentUrl: string } | null = null
    if (action === 'accepted') {
      invoiceInfo = await createInvoiceForQuote(typedQuote)
    }

    // Send Slack notification (includes payment link if accepted)
    await sendSlackNotification(typedQuote, action, invoiceInfo)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Respond quote error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
