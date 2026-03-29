import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, setupDefaultCalendars } from "@/lib/google-calendar"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  // Handle OAuth denial
  if (error) {
    console.error("Google OAuth error:", error)
    return NextResponse.redirect(
      new URL("/portal/admin/calendar-auth?error=access_denied", request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/portal/admin/calendar-auth?error=no_code", request.url)
    )
  }

  try {
    // Exchange code for tokens (saves refresh token to Supabase + .env)
    await exchangeCodeForTokens(code)

    // Setup default calendars (HomeField Hub + Dr. Squeegee)
    try {
      await setupDefaultCalendars()
    } catch (calErr) {
      // Non-fatal: calendar setup can be retried from the admin page
      console.error("Failed to setup default calendars:", calErr)
    }

    // Redirect back to admin page with success
    return NextResponse.redirect(
      new URL("/portal/admin/calendar-auth?success=connected", request.url)
    )
  } catch (err) {
    console.error("Google OAuth callback error:", err)
    const message = err instanceof Error ? err.message : "unknown_error"
    return NextResponse.redirect(
      new URL(`/portal/admin/calendar-auth?error=${encodeURIComponent(message)}`, request.url)
    )
  }
}
