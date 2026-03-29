import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

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
