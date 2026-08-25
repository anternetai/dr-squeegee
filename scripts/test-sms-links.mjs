// Reproduces (and then guards) the two ways a texted link dies on a real phone.
//
// Run: node --experimental-strip-types scripts/test-sms-links.mjs
//
// Bug 1 — UNCLICKABLE. A single em dash (U+2014) in an otherwise-ASCII message
//   forces the whole SMS from GSM-7 (160 chars/segment) to UCS-2 (70 chars, or
//   67 when concatenated). The quote text went out as THREE UCS-2 segments that
//   the handset has to reassemble; link auto-detection is exactly what breaks
//   when reassembly is imperfect or out of order.
//
// Bug 2 — NO PREVIEW + swallowed punctuation. iMessage only draws a rich preview
//   card when the message body is *just* the URL; any surrounding prose demotes
//   it to a plain blue link. And a '.' glued to the end of a URL gets pulled
//   into the href by some Android linkifiers, producing a 404 on tap.
//
// The fix these tests encode: every link-bearing text goes out as TWO messages —
// prose first (opt-out language rides here), then the bare URL alone.

import { isGsm7, sanitizeForSms, smsInfo } from "../lib/squeegee/gsm7.ts"
import { smsTemplates } from "../lib/squeegee/sms-templates.ts"

let failures = 0
let checks = 0

function check(name, cond, detail = "") {
  checks++
  if (cond) {
    console.log(`  ok   ${name}`)
  } else {
    failures++
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

const URL_RE = /https?:\/\/[^\s]*/g

// ---------------------------------------------------------------------------
console.log("\n1. The exact body that went to Curtis on 8/25 was a 3-segment UCS-2 message")
// Verbatim from sms_messages id c46cfb04 — the pre-fix composition.
const ORIGINAL =
  "Dr. Squeegee: Hi Curtis, your quote is ready: https://www.drsqueegeeclt.com/q/3885b601d6 — reply with any questions. Reply STOP to opt out."
const orig = smsInfo(ORIGINAL)
check("original is UCS-2 (the bug)", orig.encoding === "UCS-2", `got ${orig.encoding}`)
check("original is multi-segment (the bug)", orig.segments === 3, `got ${orig.segments}`)
check(
  "sanitizeForSms rescues it to GSM-7",
  isGsm7(sanitizeForSms(ORIGINAL)),
  JSON.stringify(sanitizeForSms(ORIGINAL).slice(40, 60))
)
check("sanitized em dash became a hyphen", sanitizeForSms(ORIGINAL).includes(" - reply"))

// ---------------------------------------------------------------------------
console.log("\n2. sanitizeForSms transliterates every smart-punctuation trap")
const TRAPS = [
  ["—", "-"],      // em dash
  ["–", "-"],      // en dash
  ["‘", "'"],      // curly open single
  ["’", "'"],      // curly close single (apostrophe)
  ["“", '"'],      // curly open double
  ["”", '"'],      // curly close double
  ["…", "..."],    // ellipsis
  [" ", " "],      // non-breaking space
  ["•", "*"],      // bullet
  ["→", "->"],     // arrow
]
for (const [from, to] of TRAPS) {
  const out = sanitizeForSms(`a${from}b`)
  check(`U+${from.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")} -> ${JSON.stringify(to)}`, out === `a${to}b`, JSON.stringify(out))
}
check("plain ASCII is untouched", sanitizeForSms("Hello, world! (704) 286-9696") === "Hello, world! (704) 286-9696")
check("emoji survive (Anthony's manual sends keep their voice)", sanitizeForSms("nice \u{1F9FC}").includes("\u{1F9FC}"))

// ---------------------------------------------------------------------------
console.log("\n3. Every link-bearing template returns prose and link SEPARATELY")
const linkTemplates = {
  quoteReady: smsTemplates.quoteReady("Curtis Glenn", "3885b601d6"),
  quoteFollowup: smsTemplates.quoteFollowup("Curtis Glenn", "3885b601d6"),
  invoice: smsTemplates.invoice("Curtis Glenn", "3885b601d6"),
  receipt: smsTemplates.receipt("Curtis Glenn", "d4f039002d", 350),
  quoteAcceptedBooked: smsTemplates.quoteAccepted("Curtis Glenn", "Tue, 8/25 at 12:46 PM", "https://www.drsqueegeeclt.com/appt/abc.def"),
  appointmentConfirmed: smsTemplates.appointmentConfirmed("Curtis Glenn", "House Washing", "Tue, 8/25 at 12:46 PM", "https://www.drsqueegeeclt.com/appt/abc.def"),
  reviewRequest: smsTemplates.reviewRequest("Curtis Glenn", "https://g.page/r/abc/review"),
}

for (const [name, msg] of Object.entries(linkTemplates)) {
  check(`${name}: returns {body, link}`, typeof msg?.body === "string" && typeof msg?.link === "string", JSON.stringify(msg))
  if (typeof msg?.body !== "string") continue

  check(`${name}: body contains NO url`, !URL_RE.test(msg.body) && !msg.body.includes("http"), msg.body)
  URL_RE.lastIndex = 0

  check(`${name}: body is GSM-7`, isGsm7(msg.body), msg.body)
  // Prose length is bounded but not fixed — service names and appointment labels
  // are user data. 2 GSM-7 segments is the ceiling, and a split here is harmless
  // now that the link no longer rides inside this message.
  const info = smsInfo(msg.body)
  check(`${name}: body <= 2 GSM-7 segments`, info.segments <= 2, `${info.length} chars = ${info.segments} seg (${info.encoding})`)

  // The link message: bare URL, nothing else. This is what makes iMessage
  // render a preview card and what stops a linkifier eating trailing punctuation.
  check(`${name}: link is a bare url`, /^https:\/\/[^\s]+$/.test(msg.link), JSON.stringify(msg.link))
  check(`${name}: link has no trailing punctuation`, !/[.,;:!?)\]]$/.test(msg.link), JSON.stringify(msg.link))
  check(`${name}: link is GSM-7 + 1 segment`, isGsm7(msg.link) && smsInfo(msg.link).segments === 1, `${smsInfo(msg.link).length} chars`)
}

// ---------------------------------------------------------------------------
console.log("\n4. Non-link templates stay plain strings and stay GSM-7")
const plain = {
  appointmentReminder: smsTemplates.appointmentReminder("Curtis", "House Washing", "tomorrow at 8 AM"),
  reengage: smsTemplates.reengage("Curtis"),
  quoteAcceptedUnbooked: smsTemplates.quoteAccepted("Curtis", null),
}
for (const [name, body] of Object.entries(plain)) {
  check(`${name}: is a string`, typeof body === "string", typeof body)
  if (typeof body !== "string") continue
  check(`${name}: is GSM-7`, isGsm7(body), body)
  check(`${name}: no url`, !body.includes("http"), body)
}

// ---------------------------------------------------------------------------
console.log("\n5. Opt-out language rides on the prose message, never the bare link")
for (const [name, msg] of Object.entries(linkTemplates)) {
  if (typeof msg?.body !== "string") continue
  check(`${name}: prose carries STOP`, /reply stop to opt out/i.test(msg.body), msg.body)
  check(`${name}: link message is clean of STOP`, !/stop/i.test(msg.link), msg.link)
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? "PASS" : "FAIL"} — ${checks - failures}/${checks} checks passed\n`)
process.exit(failures === 0 ? 0 : 1)
