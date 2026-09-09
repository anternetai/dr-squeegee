import { NextRequest, NextResponse } from "next/server"
import { verifyCrmAuth } from "@/lib/crm-auth-check"
import { closeOpenSegment, getCrewAdmin } from "@/lib/squeegee/crew"

/**
 * Force-close a timer the crew left running.
 *
 * The clock is driven by status taps, so a job abandoned mid-way (phone died,
 * went home without tapping Done) leaves a segment open counting all night.
 * Every product in this category has this gap and reviewers ask for exactly this
 * button.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  await closeOpenSegment(getCrewAdmin(), id)
  return NextResponse.json({ ok: true })
}
