import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyCrmAuth } from "@/lib/crm-auth-check"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
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
