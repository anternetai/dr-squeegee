import { NextResponse } from "next/server"

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set("crm_auth", "", { maxAge: 0, path: "/" })
  // Also clear any old cookie that was set with path=/crm
  res.cookies.set("crm_auth", "", { maxAge: 0, path: "/crm" })
  return res
}
