import { NextResponse } from "next/server"
import { CREW_COOKIE } from "@/lib/squeegee/employee-auth"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(CREW_COOKIE, "", { path: "/", maxAge: 0 })
  return response
}
