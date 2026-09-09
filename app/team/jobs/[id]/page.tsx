import { notFound, redirect } from "next/navigation"
import { getSessionEmployee } from "@/lib/squeegee/employee-auth"
import { getCrewAdmin, signPhotos, totalMs } from "@/lib/squeegee/crew"
import { JobView, type JobPhoto, type CrewJobDetail } from "./job-view"

export const dynamic = "force-dynamic"

export default async function CrewJobPage({ params }: { params: Promise<{ id: string }> }) {
  const employee = await getSessionEmployee()
  if (!employee) redirect("/team/login")

  const { id } = await params
  const supabase = getCrewAdmin()

  // No `price` — the crew never sees the customer's number.
  const { data: job } = await supabase
    .from("squeegee_jobs")
    .select(
      "id, client_name, client_phone, address, service_type, notes, status, field_status, appointment_date, appointment_time, completed_at, assigned_employee_id"
    )
    .eq("id", id)
    .single()

  if (!job) notFound()
  if (job.assigned_employee_id !== employee.id) {
    // Not theirs — could be unclaimed, could be someone else's. Either way the
    // board is where they should be, not a job detail they can't act on.
    redirect("/team")
  }

  const [{ data: photoRows }, { data: segments }] = await Promise.all([
    supabase
      .from("squeegee_job_photos")
      .select("id, kind, storage_path, created_at")
      .eq("job_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("squeegee_job_time")
      .select("kind, started_at, ended_at")
      .eq("job_id", id),
  ])

  const rows = (photoRows ?? []) as {
    id: string
    kind: string
    storage_path: string
  }[]
  const urls = await signPhotos(
    supabase,
    rows.map((r) => r.storage_path)
  )

  const photos: JobPhoto[] = rows.map((r) => ({
    id: r.id,
    kind: r.kind as "before" | "after",
    url: urls[r.storage_path] ?? null,
  }))

  const segs = (segments ?? []) as {
    kind: "drive" | "work"
    started_at: string
    ended_at: string | null
  }[]

  return (
    <JobView
      job={job as unknown as CrewJobDetail}
      photos={photos}
      workedMs={totalMs(segs, "work")}
      driveMs={totalMs(segs, "drive")}
      running={segs.some((s) => !s.ended_at)}
    />
  )
}
