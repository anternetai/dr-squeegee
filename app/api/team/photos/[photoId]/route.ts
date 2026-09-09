import { NextRequest, NextResponse } from "next/server"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { getCrewAdmin, PHOTO_BUCKET } from "@/lib/squeegee/crew"

/**
 * Crew deletes a photo they just took — a thumb over the lens, a shot of the
 * wrong wall. Only their own, only on a job they still hold, and only while the
 * job is open: once it's complete the photos are the record of the work.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const employee = await getSessionEmployee()
  if (!employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { photoId } = await params
  const supabase = getCrewAdmin()

  const { data: photo } = await supabase
    .from("squeegee_job_photos")
    .select("id, job_id, employee_id, storage_path")
    .eq("id", photoId)
    .single()

  if (!photo || photo.employee_id !== employee.id) {
    return NextResponse.json({ error: "That photo isn't yours." }, { status: 403 })
  }

  const { data: job } = await supabase
    .from("squeegee_jobs")
    .select("status, assigned_employee_id")
    .eq("id", photo.job_id)
    .single()

  if (!job || job.assigned_employee_id !== employee.id) {
    return NextResponse.json({ error: "That job isn't yours." }, { status: 403 })
  }
  if (job.status === "complete") {
    return NextResponse.json(
      { error: "That job is finished - ask Anthony to remove it." },
      { status: 409 }
    )
  }

  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path as string])
  await supabase.from("squeegee_job_photos").delete().eq("id", photoId)

  return NextResponse.json({ ok: true })
}
