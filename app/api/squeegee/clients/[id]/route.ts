import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyCrmAuth } from "@/lib/crm-auth-check"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Edit / blacklist a client. Replaces the browser-side anon .update() the
// client detail screen used to run. Explicit allowlist — a PATCH body must
// never be able to reach columns the CRM screen doesn't own.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json()

  const updates: Record<string, unknown> = {}
  for (const field of ["name", "phone", "email", "address", "notes"] as const) {
    if (field in body) {
      const value = typeof body[field] === "string" ? body[field].trim() : null
      updates[field] = field === "name" ? value : value || null
    }
  }
  if ("blacklisted" in body) {
    updates.blacklisted = Boolean(body.blacklisted)
    updates.blacklist_reason = updates.blacklisted
      ? body.blacklist_reason?.trim() || null
      : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 })
  }
  if ("name" in updates && !updates.name) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 })
  }

  const supabase = getAdmin()
  const { data, error } = await supabase
    .from("squeegee_clients")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const supabase = getAdmin()

  // Unlink jobs first so foreign key constraint doesn't block deletion
  await supabase.from("squeegee_jobs").update({ client_id: null }).eq("client_id", id)

  // Note: squeegee_activity only has job_id, not client_id.
  // Activity records stay with the (now-unlinked) jobs, which is correct.

  // Delete the client
  const { error } = await supabase.from("squeegee_clients").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
