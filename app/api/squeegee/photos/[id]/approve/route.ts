import { NextRequest, NextResponse } from "next/server"
import { verifyCrmAuth } from "@/lib/crm-auth-check"
import { getCrewAdmin } from "@/lib/squeegee/crew"

/**
 * Anthony decides which crew photos the customer sees on their receipt.
 *
 * Photos land customer_visible=false. One thumb-over-the-lens shot reaching a
 * customer undoes the whole trust play, so this is a deliberate approval, never
 * a default. The crew cannot call this.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const visible = body?.visible === true

  const { error } = await getCrewAdmin()
    .from("squeegee_job_photos")
    .update({
      customer_visible: visible,
      approved_at: visible ? new Date().toISOString() : null,
    })
    .eq("id", id)

  if (error) {
    console.error("Photo approve error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, visible })
}
