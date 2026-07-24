// Signed, non-enumerable token for the customer-facing appointment/calendar
// page. Same HMAC pattern as the crew/member session cookies — a job id plus an
// HMAC so anyone with the link sees that appointment, but the ids can't be
// guessed or walked.

const encoder = new TextEncoder()

function getSecret(): string {
  return (
    process.env.CREW_COOKIE_SECRET ||
    process.env.MEMBER_COOKIE_SECRET ||
    process.env.CRM_COOKIE_SECRET ||
    process.env.CRM_PASSWORD ||
    "fallback-secret"
  )
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24)
}

// token = "<jobId>.<hmac>" — base64url-safe because job ids are uuids + hex.
export async function signApptToken(jobId: string): Promise<string> {
  return `${jobId}.${await hmac(jobId)}`
}

export async function verifyApptToken(token: string): Promise<string | null> {
  const dot = token.lastIndexOf(".")
  if (dot < 0) return null
  const jobId = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = await hmac(jobId)
  if (sig.length !== expected.length) return null
  let mismatch = 0
  for (let i = 0; i < sig.length; i++) mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  return mismatch === 0 ? jobId : null
}
