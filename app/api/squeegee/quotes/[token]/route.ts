import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = getAdmin()

    const { data, error } = await supabase
      .from('squeegee_quotes')
      .select('*')
      .eq('token', token)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Get quote error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { services, total_price, notes, status } = body as {
      services?: { name: string; price: number }[]
      total_price?: number
      notes?: string
      status?: string
    }

    const supabase = getAdmin()

    const updatePayload: Record<string, unknown> = {}

    if (services !== undefined) {
      updatePayload.services = services
      // Recalculate subtotal from services if provided
      const subtotal = services.reduce((sum, s) => sum + Number(s.price), 0)
      updatePayload.subtotal = subtotal
      updatePayload.total_price = total_price !== undefined ? total_price : subtotal
    } else if (total_price !== undefined) {
      updatePayload.total_price = total_price
    }

    if (notes !== undefined) updatePayload.notes = notes
    if (status !== undefined) updatePayload.status = status

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('squeegee_quotes')
      .update(updatePayload)
      .eq('token', token)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Patch quote error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = getAdmin()

    const { error } = await supabase
      .from('squeegee_quotes')
      .delete()
      .eq('token', token)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete quote error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
