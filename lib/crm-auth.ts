/**
 * CRM Cookie Authentication
 *
 * HMAC-based cookie signing/verification for the CRM password gate.
 * Uses Web Crypto API (works in Edge Runtime / middleware).
 */

function getSecret(): string {
  const secret = process.env.CRM_COOKIE_SECRET || process.env.CRM_PASSWORD
  if (!secret) {
    console.warn("[crm-auth] Neither CRM_COOKIE_SECRET nor CRM_PASSWORD is set — using weak fallback")
  }
  return secret || "fallback-secret"
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function signCrmCookie(value: string): Promise<string> {
  const secret = getSecret()
  const signature = await hmacSign(secret, value)
  return `${value}.${signature}`
}

export async function verifyCrmCookieSignature(signed: string): Promise<boolean> {
  const secret = getSecret()
  const lastDot = signed.lastIndexOf(".")
  if (lastDot === -1) return false
  const value = signed.slice(0, lastDot)
  const signature = signed.slice(lastDot + 1)
  const expected = await hmacSign(secret, value)

  // Constant-time comparison
  if (signature.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return mismatch === 0
}
