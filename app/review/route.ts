import { NextResponse } from "next/server"

// Clean, memorable review link: drsqueegeeclt.com/review → Dr. Squeegee's Google
// "write a review" page. Used in review-request texts so the SMS reads tidy
// instead of the raw Google URL. Target is the public place ID for Dr. Squeegee
// Home Cleaning (hardcoded so this never loops back through GOOGLE_REVIEW_URL,
// which now points here).
const GOOGLE_WRITE_REVIEW =
  "https://search.google.com/local/writereview?placeid=ChIJx-3-oXqjVogRsQbP1aPSDF8"

export function GET() {
  return NextResponse.redirect(GOOGLE_WRITE_REVIEW, 302)
}
