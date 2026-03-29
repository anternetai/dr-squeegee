import { NextRequest, NextResponse } from "next/server"
import { signCrmCookie } from "@/lib/crm-auth"

// Simple in-memory rate limiter (per IP, 5 attempts per minute)
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 })
    return false
  }
  entry.count++
  return entry.count > 5
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 })
  }

  const { password } = await req.json()
  const correct = process.env.CRM_PASSWORD

  if (!correct || password !== correct) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const signedValue = await signCrmCookie("authenticated")
  const res = NextResponse.json({ success: true })
  res.cookies.set("crm_auth", signedValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  })
  return res
}
