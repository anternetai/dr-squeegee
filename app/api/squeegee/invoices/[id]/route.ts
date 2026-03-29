import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, amount, due_date, notes } = body as {
      status?: string
      amount?: number
      due_date?: string | null
      notes?: string | null
    }

    const supabase = getAdmin()

    const updatePayload: Record<string, unknown> = {}

    if (status !== undefined) {
      if (!['draft', 'sent', 'paid', 'overdue'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updatePayload.status = status
      if (status === 'paid') {
        updatePayload.paid_at = new Date().toISOString()
      }
    }

    if (amount !== undefined) {
      if (typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
      }
      updatePayload.amount = amount
    }

    if (due_date !== undefined) updatePayload.due_date = due_date || null
    if (notes !== undefined) updatePayload.notes = notes || null

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: invoice, error } = await supabase
      .from('squeegee_invoices')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Log activity if status changed
    if (status !== undefined) {
      const activityNote =
        status === 'sent'
          ? `Invoice ${invoice.invoice_number} marked as sent`
          : status === 'paid'
          ? `Invoice ${invoice.invoice_number} marked as paid — $${Number(invoice.amount).toFixed(2)}`
          : `Invoice ${invoice.invoice_number} status updated to ${status}`

      await supabase.from('squeegee_activity').insert({
        job_id: invoice.job_id,
        type: `invoice_${status}`,
        note: activityNote,
      })
    } else {
      // Log edit activity
      await supabase.from('squeegee_activity').insert({
        job_id: invoice.job_id,
        type: 'invoice_edited',
        note: `Invoice ${invoice.invoice_number} details updated`,
      })
    }

    return NextResponse.json(invoice)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getAdmin()

    // Fetch invoice first so we can log the deletion
    const { data: invoice } = await supabase
      .from('squeegee_invoices')
      .select('id, job_id, invoice_number, amount')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('squeegee_invoices')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log activity
    if (invoice) {
      await supabase.from('squeegee_activity').insert({
        job_id: invoice.job_id,
        type: 'invoice_deleted',
        note: `Invoice ${invoice.invoice_number} deleted ($${Number(invoice.amount).toFixed(2)})`,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
