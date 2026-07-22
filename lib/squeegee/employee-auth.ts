// Dr. Squeegee crew — employee authentication.
// Same scrypt + HMAC-signed-cookie pattern as lib/squeegee/member-auth.ts, but a
// separate cookie so a logged-in customer (member_session) and a logged-in crew
// member (crew_session) never collide. Sessions last 30 days — crew, not a bank.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

const scrypt = promisify(scryptCb)

export const CREW_COOKIE = "crew_session"
const SESSION_DAYS = 30

function getSecret(): string {
  const secret =
    process.env.CREW_COOKIE_SECRET ||
    process.env.MEMBER_COOKIE_SECRET ||
    process.env.CRM_COOKIE_SECRET ||
    process.env.CRM_PASSWORD
  if (!secret) {
    console.warn("[employee-auth] No cookie secret set — using weak fallback")
  }
  return secret || "fallback-secret"
}

// ---- passwords ----

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString("hex")}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const derived = (await scrypt(password, salt, 64)) as Buffer
  const expected = Buffer.from(hash, "hex")
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}

// ---- session cookie: "<employeeId>.<expiresEpochMs>.<hmac>" ----

async function hmacSign(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function createSessionValue(employeeId: string): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 864e5
  const payload = `${employeeId}.${expires}`
  const sig = await hmacSign(payload)
  return `${payload}.${sig}`
}

export async function verifySessionValue(value: string): Promise<string | null> {
  const parts = value.split(".")
  if (parts.length !== 3) return null
  const [employeeId, expiresStr, sig] = parts
  const expected = await hmacSign(`${employeeId}.${expiresStr}`)
  if (sig.length !== expected.length) return null
  let mismatch = 0
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  if (mismatch !== 0) return null
  if (Number(expiresStr) < Date.now()) return null
  return employeeId
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  }
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface SqueegeeEmployee {
  id: string
  created_at: string
  name: string
  phone: string | null
  email: string | null
  role: string
  status: string
  pay_type: string
  pay_rate: number | null
  availability: Record<string, boolean> | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  onboarded_at: string | null
  last_login_at: string | null
}

const EMPLOYEE_COLS =
  "id, created_at, name, phone, email, role, status, pay_type, pay_rate, availability, address, emergency_contact_name, emergency_contact_phone, onboarded_at, last_login_at"

// Server-component helper: current crew member from the session cookie, or null.
// Only active/onboarding employees resolve — a deactivated login goes dead.
export async function getSessionEmployee(): Promise<SqueegeeEmployee | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(CREW_COOKIE)
  if (!cookie?.value) return null
  const employeeId = await verifySessionValue(cookie.value)
  if (!employeeId) return null

  const { data } = await getAdmin()
    .from("squeegee_employees")
    .select(EMPLOYEE_COLS)
    .eq("id", employeeId)
    .single()
  const emp = data as SqueegeeEmployee | null
  if (!emp || emp.status === "inactive") return null
  return emp
}
