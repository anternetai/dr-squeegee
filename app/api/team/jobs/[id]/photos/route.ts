import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { getCrewAdmin, PHOTO_BUCKET } from "@/lib/squeegee/crew"

// The client resizes to ~1600px/q0.8 before upload (~250KB). This ceiling is the
// backstop for a client that didn't, not the expected size — without the resize
// step the free storage tier is gone in a few months.
const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = ["image/jpeg", "image/webp", "image/png"]

/** Crew uploads a before/after photo for a job they hold. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const employee = await getSessionEmployee()
  if (!employee) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const supabase = getCrewAdmin()

  const { data: job } = await supabase
    .from("squeegee_jobs")
    .select("id, assigned_employee_id, status")
    .eq("id", id)
    .single()

  if (!job || job.assigned_employee_id !== employee.id) {
    return NextResponse.json({ error: "That job isn't yours." }, { status: 403 })
  }
  if (job.status === "complete") {
    return NextResponse.json({ error: "That job is already finished." }, { status: 409 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  const kind = String(form?.get("kind") ?? "")

  if (kind !== "before" && kind !== "after") {
    return NextResponse.json({ error: "Photo must be before or after." }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo received." }, { status: 400 })
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too big." }, { status: 400 })
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "That file isn't a photo." }, { status: 400 })
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const storagePath = `${id}/${kind}/${randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    console.error("Photo upload error:", uploadError)
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 })
  }

  const { data: row, error: insertError } = await supabase
    .from("squeegee_job_photos")
    .insert({
      job_id: id,
      employee_id: employee.id,
      kind,
      storage_path: storagePath,
    })
    .select("id, kind, storage_path")
    .single()

  if (insertError) {
    // Don't leave an orphan blob behind paying for storage forever.
    await supabase.storage.from(PHOTO_BUCKET).remove([storagePath])
    console.error("Photo insert error:", insertError)
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 })
  }

  const { data: signed } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  return NextResponse.json({
    ok: true,
    photo: { id: row.id, kind: row.kind, url: signed?.signedUrl ?? null },
  })
}
