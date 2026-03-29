import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover',
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { job_id, client_id, amount, due_date, notes } = body

    if (!job_id || !amount) {
      return NextResponse.json({ error: 'job_id and amount are required' }, { status: 400 })
    }

    const supabase = getAdmin()
    const stripe = getStripe()

    // Invoice number: INV-{year}-{count+1}
    const { count } = await supabase.from('squeegee_invoices').select('*', { count: 'exact', head: true })
    const sequence = (count ?? 0) + 1001
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`

    // Create Stripe Payment Link
    const amountInCents = Math.round(Number(amount) * 100)
    const stripePrice = await stripe.prices.create({
      currency: 'usd',
      unit_amount: amountInCents,
      product_data: { name: 'Dr. Squeegee House Washing Services' },
    })
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
    })

    // Save invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('squeegee_invoices')
      .insert({
        job_id,
        client_id: client_id || null,
        invoice_number: invoiceNumber,
        amount: Number(amount),
        due_date: due_date || null,
        notes: notes || null,
        status: 'draft',
        stripe_payment_link: paymentLink.url,
      })
      .select()
      .single()

    if (invoiceError) {
      return NextResponse.json({ error: invoiceError.message }, { status: 500 })
    }

    // Log activity
    await supabase.from('squeegee_activity').insert({
      job_id,
      type: 'invoice_created',
      note: `Invoice ${invoiceNumber} created for $${Number(amount).toFixed(2)}`,
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
