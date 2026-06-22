// Follow-up / re-engagement helpers for the Dr. Squeegee CRM.
// Past customers are consolidated by their phone number (last 10 digits = natural key)
// across jobs, quotes, clients and leads. Outreach (manual texts/calls) is logged
// to the `squeegee_outreach` table keyed by the same phone10.

export interface FollowupCustomer {
  phone10: string
  name: string
  email: string | null
  address: string | null
  servicesHad: string[] // distinct service types from jobs/quotes/leads
  lastServiceType: string | null // service on their most recent job
  jobCount: number
  quoteCount: number
  lifetimeValue: number
  lastServiceDate: string | null // ISO timestamp of most recent job
  firstSeen: string | null
  sources: string[] // 'client' | 'job' | 'quote' | 'lead'
  // outreach-derived
  lastContactedAt: string | null
  lastContactChannel: string | null
  servicesOffered: string[] // services we've already pitched (from outreach log)
}

// Obvious placeholder / test numbers we don't want to text.
export const PLACEHOLDER_PHONES = new Set(["1234567890", "0000000000", "1111111111"])

export function firstName(name: string): string {
  const n = (name || "").trim()
  if (!n) return "there"
  // strip leading non-letters, take first token
  const first = n.split(/\s+/)[0].replace(/[^A-Za-z'-]/g, "")
  return first || "there"
}

export function formatPhone(phone10: string): string {
  if (phone10 && phone10.length === 10) {
    return `(${phone10.slice(0, 3)}) ${phone10.slice(3, 6)}-${phone10.slice(6)}`
  }
  return phone10 || "—"
}

export function telUrl(phone10: string): string {
  return `tel:+1${phone10}`
}

export function smsUrl(phone10: string, body: string): string {
  // `?&body=` form is the most cross-platform (works on iOS + Android).
  return `sms:+1${phone10}?&body=${encodeURIComponent(body)}`
}

/** Whole days since an ISO timestamp. null if no date. */
export function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return null
  return Math.floor((Date.now() - then) / 86_400_000)
}

export function relativeDayLabel(iso: string | null): string {
  const d = daysSince(iso)
  if (d === null) return "—"
  if (d <= 0) return "today"
  if (d === 1) return "yesterday"
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.round(d / 30)}mo ago`
  return `${Math.round(d / 365)}y ago`
}

export function shortDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })
}

function monthName(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: "long" })
}

/**
 * Build a pre-written SMS for a given service. Editable in the user's Messages
 * app before sending. Reads naturally whether or not the customer has history.
 */
export function buildMessage(service: string, c: FollowupCustomer): string {
  const first = firstName(c.name)
  const had = c.servicesHad.includes(service)
  const month = monthName(c.lastServiceDate)
  const lastWork = (c.lastServiceType || c.servicesHad[0] || "").toLowerCase()

  // Returning customer for THIS service → rebook tone.
  if (had) {
    const ago = month ? ` back in ${month}` : ""
    return (
      `Hey ${first}! It's Anthony with Dr. Squeegee 🪟 ` +
      `We did your ${service.toLowerCase()}${ago} — figured it might be about time for a refresh. ` +
      `Want me to get you back on the schedule at your returning-customer rate? Just reply and I'll lock it in.`
    )
  }

  // Reference past work if we have it.
  let ref = ""
  if (lastWork && month) {
    ref = `Thanks again for letting us handle your ${lastWork} back in ${month} — hope it's still looking great. `
  } else if (lastWork) {
    ref = `Thanks again for trusting us with your ${lastWork}. `
  }

  if (service === "Window Cleaning") {
    return (
      `Hey ${first}! It's Anthony with Dr. Squeegee 🪟 ` +
      ref +
      `We just added pro window cleaning — inside & out, screens and sills included, totally streak-free. ` +
      `Want a quick quote? Happy to set you up with a loyal-customer rate.`
    )
  }

  return (
    `Hey ${first}! It's Anthony with Dr. Squeegee 👋 ` +
    ref +
    `We also do ${service.toLowerCase()} now — want me to send over a quick quote? ` +
    `I'll take care of you with a loyal-customer rate.`
  )
}

export type FlagKind = "needs" | "offered" | "had"

/** What badge to show for a customer relative to the currently-pitched service. */
export function serviceFlag(c: FollowupCustomer, service: string): FlagKind {
  if (c.servicesHad.includes(service)) return "had"
  if (c.servicesOffered.includes(service)) return "offered"
  return "needs"
}
