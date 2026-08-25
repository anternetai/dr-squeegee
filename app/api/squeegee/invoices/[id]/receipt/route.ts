import { NextRequest, NextResponse } from 'next/server'
import { verifyCrmAuth } from '@/lib/crm-auth-check'
import { sendReceiptForInvoice } from '@/lib/squeegee/send-receipt'
import { getReceiptByInvoiceId } from '@/lib/squeegee/receipt'

// Manual receipt send from the CRM. Covers the payments Stripe never sees (cash,
// check, Zelle) and re-sends when a customer says it never arrived.
//
// GET  — preview the receipt data + URL without sending anything.
// POST — deliver it. Body: { channels?: ("sms"|"email")[] }

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const receipt = await getReceiptByInvoiceId(id)
  if (!receipt) {
    return NextResponse.json({ error: 'Invoice not found, or not paid yet' }, { status: 404 })
  }
  return NextResponse.json({
    receipt,
    receiptUrl: `https://www.drsqueegeeclt.com/r/${receipt.receiptToken}`,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await verifyCrmAuth())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params

    let channels: ('sms' | 'email')[] | undefined
    try {
      const body = await request.json()
      if (Array.isArray(body?.channels) && body.channels.length > 0) {
        channels = body.channels.filter((c: unknown) => c === 'sms' || c === 'email')
      }
    } catch {
      // No body — deliver on every channel we have contact details for.
    }

    const result = await sendReceiptForInvoice(id, channels ? { channels } : {})

    if (!result.ok) {
      // 200 with ok:false — the invoice is fine, only delivery failed, and the
      // CRM needs the reason to show rather than a thrown error.
      return NextResponse.json(
        {
          ok: false,
          reason: result.sms?.reason ?? result.email?.reason ?? result.reason ?? 'not sent',
          receiptUrl: result.receiptUrl,
          sms: result.sms,
          email: result.email,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      ok: true,
      receiptUrl: result.receiptUrl,
      sms: result.sms,
      email: result.email,
    })
  } catch (err) {
    console.error('Send receipt error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
