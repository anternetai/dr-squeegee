import { NextRequest, NextResponse } from "next/server"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { getCrewAdmin } from "@/lib/squeegee/crew"

/** Store (or refresh) a push subscription for the logged-in crew member. */
export async function POST(request: NextRequest) {
  const employee = await getSessionEmployee()
  if (!employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth

  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return NextResponse.json({ error: "Bad subscription." }, { status: 400 })
  }

  // Endpoint is unique: re-subscribing on the same device updates in place, and a
  // phone handed to a different employee re-points rather than duplicating.
  const { error } = await getCrewAdmin()
    .from("squeegee_push_subscriptions")
    .upsert(
      {
        employee_id: employee.id,
        endpoint,
        p256dh,
        auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
        failure_count: 0,
      },
      { onConflict: "endpoint" }
    )

  if (error) {
    console.error("Push subscribe error:", error)
    return NextResponse.json({ error: "Could not save it." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
