// Dr. Squeegee Care Club — member authentication.
// scrypt password hashing + HMAC-signed session cookie (same signing pattern
// as lib/crm-auth.ts). Sessions last a year — it's a membership, not a bank.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

const scrypt = promisify(scryptCb)

export const MEMBER_COOKIE = "member_session"
const SESSION_DAYS = 365

function getSecret(): string {
  const secret =
    process.env.MEMBER_COOKIE_SECRET ||
    process.env.CRM_COOKIE_SECRET ||
    process.env.CRM_PASSWORD
  if (!secret) {
    console.warn("[member-auth] No cookie secret set — using weak fallback")
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

// ---- session cookie: "<memberId>.<expiresEpochMs>.<hmac>" ----

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

export async function createSessionValue(memberId: string): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 864e5
  const payload = `${memberId}.${expires}`
  const sig = await hmacSign(payload)
  return `${payload}.${sig}`
}

export async function verifySessionValue(value: string): Promise<string | null> {
  const parts = value.split(".")
  if (parts.length !== 3) return null
  const [memberId, expiresStr, sig] = parts
  const expected = await hmacSign(`${memberId}.${expiresStr}`)
  if (sig.length !== expected.length) return null
  let mismatch = 0
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  if (mismatch !== 0) return null
  if (Number(expiresStr) < Date.now()) return null
  return memberId
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

export interface SqueegeeMember {
  id: string
  created_at: string
  plan_id: string
  email: string
  member_number: number
  slug: string | null
  last_login_at: string | null
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Server-component helper: current member from the session cookie, or null.
export async function getSessionMember(): Promise<SqueegeeMember | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(MEMBER_COOKIE)
  if (!cookie?.value) return null
  const memberId = await verifySessionValue(cookie.value)
  if (!memberId) return null

  const { data } = await getAdmin()
    .from("squeegee_members")
    .select("id, created_at, plan_id, email, member_number, slug, last_login_at")
    .eq("id", memberId)
    .single()
  return (data as SqueegeeMember) ?? null
}

// First-name vanity slug, deduped: yvette, yvette2, yvette3…
export async function generateMemberSlug(clientName: string): Promise<string> {
  const base =
    clientName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "member"
  const supabase = getAdmin()
  const { data } = await supabase
    .from("squeegee_members")
    .select("slug")
    .like("slug", `${base}%`)
  const taken = new Set((data ?? []).map((r) => r.slug))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}${n}`)) n++
  return `${base}${n}`
}
