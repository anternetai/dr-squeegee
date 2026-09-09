import { NextRequest, NextResponse } from "next/server"
import { getCrewAdmin, PHOTO_BUCKET } from "@/lib/squeegee/crew"

/**
 * Serves one approved job photo to whoever holds the receipt link.
 *
 * A proxy rather than a signed URL because a receipt is texted and opened days or
 * weeks later — any signed URL would be dead by then. The bucket stays private
 * and every request is re-checked: the receipt token must be for a PAID invoice,
 * the photo must belong to that invoice's job, and it must be approved for the
 * customer. Fail any of those and it's a 404, not a redirect.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; photoId: string }> }
) {
  const { token, photoId } = await params
  const supabase = getCrewAdmin()

  const { data: invoice } = await supabase
    .from("squeegee_invoices")
    .select("job_id, status")
    .eq("receipt_token", token)
    .maybeSingle()

  if (!invoice || invoice.status !== "paid" || !invoice.job_id) {
    return new NextResponse(null, { status: 404 })
  }

  const { data: photo } = await supabase
    .from("squeegee_job_photos")
    .select("storage_path, job_id, customer_visible")
    .eq("id", photoId)
    .maybeSingle()

  if (!photo || !photo.customer_visible || photo.job_id !== invoice.job_id) {
    return new NextResponse(null, { status: 404 })
  }

  const { data: file, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .download(photo.storage_path as string)

  if (error || !file) {
    return new NextResponse(null, { status: 404 })
  }

  return new NextResponse(file, {
    headers: {
      "Content-Type": file.type || "image/jpeg",
      // Private: it's one customer's property. A long max-age is safe because the
      // photo at a given id never changes.
      "Cache-Control": "private, max-age=86400",
    },
  })
}
