// SMS encoding safety. Deliberately dependency-free so scripts/test-sms-links.mjs
// can import it directly under `node --experimental-strip-types`.
//
// WHY THIS EXISTS: a single non-GSM-7 character flips an entire SMS from GSM-7
// (160 chars per segment) to UCS-2 (70, or 67 once concatenated). On 8/25 one
// em dash turned a 139-character quote text into a THREE-segment UCS-2 message.
// Multi-segment messages have to be reassembled by the handset, and link
// auto-detection is precisely what breaks when that reassembly is imperfect.
// The customer sees a link that is plain grey text and cannot be tapped.
//
// A rule written in a template is a request; a rule written here is a control —
// sendSms() runs every outbound body through sanitizeForSms(), so no caller can
// reintroduce the bug by typing a nice-looking dash.

// GSM 03.38 basic character set.
const GSM7_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
)

// Extension table. These are legal but cost TWO septets each.
const GSM7_EXT = new Set("^{}\\[~]|€")

/** Characters that are safe but transliterated anyway would be wrong to drop. */
export function isGsm7(s: string): boolean {
  for (const ch of s) {
    if (!GSM7_BASIC.has(ch) && !GSM7_EXT.has(ch)) return false
  }
  return true
}

// The smart-punctuation that editors, phones, and LLMs insert without anyone
// noticing. Every one of these is invisible-to-the-eye but doubles the cost of
// the message and risks the link.
const TRANSLITERATE: Record<string, string> = {
  "—": "-",    // — em dash        <- the 8/25 culprit
  "–": "-",    // – en dash
  "‒": "-",    // ‒ figure dash
  "―": "-",    // ― horizontal bar
  "‘": "'",    // ' left single quote
  "’": "'",    // ' right single quote / apostrophe
  "‚": "'",    // ‚ single low quote
  "‛": "'",
  "“": '"',    // " left double quote
  "”": '"',    // " right double quote
  "„": '"',    // „ double low quote
  "…": "...",  // … ellipsis
  " ": " ",    // non-breaking space
  " ": " ",    // narrow no-break space
  " ": " ",    // thin space
  "​": "",     // zero-width space
  "‎": "",     // LTR mark
  "‏": "",     // RTL mark
  "﻿": "",     // BOM
  "•": "*",    // • bullet
  "·": "*",    // · middle dot
  "→": "->",   // → arrow
  "←": "<-",   // ←
  "°": " deg", // °
  "™": "(TM)", // ™
  "®": "(R)",  // ®
  "©": "(C)",  // ©
  "½": "1/2",  // ½
  "¼": "1/4",  // ¼
  "¾": "3/4",  // ¾
  "′": "'",    // ′ prime
  "″": '"',    // ″ double prime
  "‐": "-",    // ‐ hyphen
  "‑": "-",    // ‑ non-breaking hyphen
}

/**
 * Replace smart punctuation with its GSM-7 equivalent.
 *
 * Intentionally does NOT strip characters it has no mapping for (emoji, accented
 * names). Anthony's manual CRM texts go through this same path and silently
 * eating his 🧼 would be worse than paying for UCS-2. What matters is that the
 * *link* travels in its own message — see sendSmsWithLink — where it is always
 * pure ASCII and therefore always a single GSM-7 segment.
 */
export function sanitizeForSms(body: string): string {
  let out = ""
  for (const ch of body) {
    out += ch in TRANSLITERATE ? TRANSLITERATE[ch] : ch
  }
  return out
}

export interface SmsInfo {
  encoding: "GSM-7" | "UCS-2"
  /** Character count as the carrier bills it (GSM-7 extension chars count twice). */
  length: number
  segments: number
}

/** What this body will actually cost and how many pieces the handset must rejoin. */
export function smsInfo(body: string): SmsInfo {
  if (!isGsm7(body)) {
    // UCS-2 counts UTF-16 code units; astral chars (emoji) are surrogate pairs.
    const units = body.length
    return {
      encoding: "UCS-2",
      length: units,
      segments: units === 0 ? 1 : units <= 70 ? 1 : Math.ceil(units / 67),
    }
  }
  let septets = 0
  for (const ch of body) septets += GSM7_EXT.has(ch) ? 2 : 1
  return {
    encoding: "GSM-7",
    length: septets,
    segments: septets === 0 ? 1 : septets <= 160 ? 1 : Math.ceil(septets / 153),
  }
}

/**
 * True when a string is safe to send as a standalone link message: a bare URL,
 * no whitespace, no trailing punctuation for a linkifier to swallow into the
 * href, and cheap enough to never be split.
 */
export function isSendableLink(link: string): boolean {
  if (!/^https:\/\/[^\s]+$/.test(link)) return false
  if (/[.,;:!?)\]]$/.test(link)) return false
  return isGsm7(link) && smsInfo(link).segments === 1
}
