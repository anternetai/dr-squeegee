import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { verifyCrmCookieSignature } from "@/lib/crm-auth"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Markdown mirror — rewrite .md URLs to API handler
  if (pathname.endsWith(".md")) {
    const cleanPath = pathname.slice(0, -3) || "/"
    return NextResponse.rewrite(
      new URL(`/api/llms/md?path=${encodeURIComponent(cleanPath)}`, request.url)
    )
  }

  // CRM auth gate — protect all /crm routes except /crm/login
  if (pathname.startsWith("/crm") && !pathname.startsWith("/crm/login")) {
    const crmAuth = request.cookies.get("crm_auth")
    if (!crmAuth || !(await verifyCrmCookieSignature(crmAuth.value))) {
      const loginUrl = new URL("/crm/login", request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    "/crm/:path*",
    "/((?!_next|api|favicon).*\\.md)",
  ],
}
