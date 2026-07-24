import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { smsInvoice, smsQuoteAccepted } from '@/lib/squeegee/sms-events'
import { formatApptLabel } from '@/lib/squeegee/sms-templates'
import { recordConsentByPhone } from '@/lib/squeegee/sms'

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

  // Generate invoice number
  const { count } = await supabase
    .from('squeegee_invoices')
    .select('*', { count: 'exact', head: true })
  const sequence = (count ?? 0) + 1001
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`

  // No Stripe payment link anymore: the customer pays on OUR branded /q page
  // (embedded pay card, Apple Pay active on drsqueegeeclt.com). The webhook's
  // payment_intent.succeeded path marks the invoice paid. Legacy invoices with
  // old payment links keep working via the checkout.session.completed path.
  const serviceNames = quote.services.map((s) => s.name).join(', ')

  // Due in 7 days
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 7)

  // Save invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('squeegee_invoices')
    .insert({
      job_id: quote.job_id,
      quote_id: quote.id,
      invoice_number: invoiceNumber,
      amount: Number(quote.total_price),
      due_date: dueDate.toISOString().split('T')[0],
      notes: `Auto-generated from accepted quote. Services: ${serviceNames}`,
      status: 'sent',
      stripe_payment_link: null,
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

  return {
    invoiceId: invoice.id,
    invoiceNumber,
    amount: Number(quote.total_price),
    // Customer pays on the branded quote page (embedded pay card).
    paymentUrl: `https://www.drsqueegeeclt.com/q/${quote.token}`,
  }
}

async function sendSlackNotification(
  quote: SqueegeeQuote,
  action: QuoteAction,
  invoiceInfo?: { invoiceNumber: string; paymentUrl: string; amount?: number; invoiceId?: string } | null,
  appointment?: { date: string; time: string | null } | null,
  textSent?: boolean
) {
  const services = Array.isArray(quote.services) ? quote.services : []
  const serviceNames = services.map((s: QuoteService) => s.name).join(', ')
  const emoji = ACTION_EMOJI[action]
  const label = ACTION_LABEL[action]

  let text = `${emoji} *${label}*\n*Client:* ${quote.client_name}\n*Address:* ${quote.address}\n*Services:* ${serviceNames}\n*Total:* $${Number(quote.total_price).toFixed(2)}`

  if (action === 'accepted') {
    const scheduleLine = `Schedule this job${quote.job_id ? `: https://www.drsqueegeeclt.com/crm/jobs/${quote.job_id}` : ' in /crm/jobs'}.`
    if (!textSent) {
      // No consent on file / opted out / send failed — nobody has told the
      // customer anything. Don't claim otherwise.
      text += `\n\n⚠️ Auto-text did NOT go out (no consent on file, opted out, or send failed) — text them yourself: ${quote.client_phone ?? 'N/A'}. ${scheduleLine}`
    } else {
      text += appointment
        ? `\n\n📅 Already on the schedule for ${formatApptLabel(appointment.date, appointment.time)} — customer auto-texted their confirmed time.`
        : `\n\n📅 Customer auto-texted (accepted + "we'll confirm your time shortly"). ${scheduleLine}`
    }
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

    // Idempotency guard: only pending/help quotes accept a response.
    // accepted/declined are terminal — repeat POSTs (double-tap, retries)
    // must not re-run status changes or spawn a second invoice + Stripe
    // payment link. 'help' stays open: a client who asked questions can
    // still accept or decline once they hear back.
    if (quote.status !== 'pending' && quote.status !== 'help') {
      return NextResponse.json({ ok: true, alreadyResponded: true })
    }
    // Repeat "I have questions" taps shouldn't re-notify.
    if (quote.status === 'help' && action === 'help') {
      return NextResponse.json({ ok: true, alreadyResponded: true })
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
    let invoiceInfo:
      | { invoiceId: string; invoiceNumber: string; amount: number; paymentUrl: string }
      | null = null
    let appointment: { date: string; time: string | null } | null = null
    let textSent = false
    if (action === 'accepted') {
      // Tapping Accept is an opt-in (disclosure sits next to the button) — record
      // consent so confirmations/reminders flow without a "reply YES" step.
      await recordConsentByPhone(typedQuote.client_phone, 'accept').catch(() => {})

      invoiceInfo = await createInvoiceForQuote(typedQuote)

      // Rare, but honor it: if the linked job already has an appointment set
      // (scheduled before the quote was accepted), tell the customer the time
      // instead of the generic "we'll confirm shortly" line.
      if (typedQuote.job_id) {
        const { data: job } = await supabase
          .from('squeegee_jobs')
          .select('appointment_date, appointment_time, service_type')
          .eq('id', typedQuote.job_id)
          .single()
        if (job?.appointment_date) {
          appointment = { date: job.appointment_date as string, time: job.appointment_time as string | null }
        }
      }

      // Text the customer their invoice + secure pay link (consent-gated).
      await smsInvoice({
        name: typedQuote.client_name,
        phone: typedQuote.client_phone,
        token: typedQuote.token,
        quoteId: typedQuote.id,
      }).catch(() => {})

      // Text the customer an acceptance confirmation — appointment time if
      // already scheduled, otherwise a "we'll confirm shortly" holding line.
      textSent = await smsQuoteAccepted({
        name: typedQuote.client_name,
        phone: typedQuote.client_phone,
        whenLabel: appointment ? formatApptLabel(appointment.date, appointment.time) : null,
        quoteId: typedQuote.id,
        jobId: typedQuote.job_id,
      }).then((r) => r.sent).catch(() => false)
    }

    // Send Slack notification (includes payment link if accepted)
    await sendSlackNotification(typedQuote, action, invoiceInfo, appointment, textSent)

    // Return invoice info so the quote page can show the pay card immediately
    // after accept, with no second round-trip.
    return NextResponse.json({
      ok: true,
      invoice: invoiceInfo
        ? {
            id: invoiceInfo.invoiceId,
            invoice_number: invoiceInfo.invoiceNumber,
            amount: invoiceInfo.amount,
          }
        : null,
    })
  } catch (err) {
    console.error('Respond quote error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
