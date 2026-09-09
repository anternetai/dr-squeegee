import { NextRequest, NextResponse } from "next/server"
import { verifyCrmAuth } from "@/lib/crm-auth-check"
import { getCrewAdmin } from "@/lib/squeegee/crew"

/**
 * Clear a PIN lockout. The lockout is what makes a 4-digit PIN safe, so it stays
 * strict — but a crew member standing in a driveway who fat-fingered it five
 * times shouldn't have to wait out the clock when Anthony is right there.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params

  const { error } = await getCrewAdmin()
    .from("squeegee_employees")
    .update({ pin_attempts: 0, pin_locked_until: null })
    .eq("id", id)

  if (error) {
    console.error("Crew unlock error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
