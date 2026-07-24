// SMS copy. Kept deliberately close to the message_samples registered on the
// A2P campaign (quote follow-ups, appointment reminders, service updates,
// invoices) so every send matches what the carrier approved. The send helper
// guarantees the STOP line, but we include it here too to mirror the samples.

const SITE = "https://www.drsqueegeeclt.com"
const CALL = "(704) 286-9696"

function first(name: string | null | undefined): string {
  return (name || "there").trim().split(/\s+/)[0]
}

// "Mon 7/28 at 8:30 AM" — date is YYYY-MM-DD, time is HH:MM[:SS] or null for date-only.
export function formatApptLabel(date: string, time: string | null): string {
  const [y, m, d] = date.split("-").map(Number)
  const dayLabel = new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  })
  if (!time) return dayLabel
  const [h, min] = time.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hr = h % 12 || 12
  const minLabel = min ? `:${String(min).padStart(2, "0")}` : ""
  return `${dayLabel} at ${hr}${minLabel} ${ampm}`
}

export const smsTemplates = {
  quoteReady(name: string | null, token: string): string {
    return `Dr. Squeegee: Hi ${first(name)}, your quote is ready: ${SITE}/q/${token} — reply with any questions. Reply STOP to opt out.`
  },

  quoteFollowup(name: string | null, token: string): string {
    return `Dr. Squeegee: Hi ${first(name)}, just following up on your quote — still happy to get you on the schedule: ${SITE}/q/${token}. Reply STOP to opt out.`
  },

  // whenLabel e.g. "tomorrow at 8:30 AM" / "today at 9 AM"
  appointmentReminder(name: string | null, service: string, whenLabel: string): string {
    return `Dr. Squeegee: Reminder — we're scheduled for your ${service.toLowerCase()} ${whenLabel}. Reply YES to confirm or call ${CALL} to reschedule. Reply STOP to opt out.`
  },

  invoice(name: string | null, token: string): string {
    return `Dr. Squeegee: Thanks for having us out, ${first(name)}! Your invoice with a secure payment link: ${SITE}/q/${token}. Reply STOP to opt out.`
  },

  // Sent the moment a quote is accepted. whenLabel set = appointment already on
  // the job (formatApptLabel output); null = not scheduled yet. calUrl adds the
  // one-tap add-to-calendar link when it's a booked appointment.
  quoteAccepted(name: string | null, whenLabel: string | null, calUrl?: string): string {
    if (whenLabel) {
      const cal = calUrl ? ` Add it to your calendar: ${calUrl}.` : ""
      return `Dr. Squeegee: Thanks for accepting, ${first(name)}! You're on the schedule for ${whenLabel}.${cal} Reply STOP to opt out.`
    }
    return `Dr. Squeegee: Thanks for accepting, ${first(name)}! We'll text you shortly to confirm your appointment time. Reply STOP to opt out.`
  },

  // Sent the moment a job is scheduled/rescheduled — distinct from the
  // day-before appointmentReminder above. calUrl = one-tap add-to-calendar link.
  appointmentConfirmed(name: string | null, service: string, whenLabel: string, calUrl?: string): string {
    const cal = calUrl ? ` Add it to your calendar: ${calUrl}.` : ""
    return `Dr. Squeegee: You're confirmed for your ${service.toLowerCase()} ${whenLabel}.${cal} Need to reschedule? Call ${CALL}. Reply STOP to opt out.`
  },

  reviewRequest(name: string | null, reviewUrl: string): string {
    return `Dr. Squeegee: Thanks again, ${first(name)}! If we did right by you, a quick review would mean a lot: ${reviewUrl} Reply STOP to opt out.`
  },

  // Win-back to a PAST customer who previously consented — never a cold number.
  reengage(name: string | null): string {
    return `Dr. Squeegee: Hi ${first(name)}, it's been a while! Ready to get your home looking sharp again? Reply here or call ${CALL} for a quick quote. Reply STOP to opt out.`
  },
}

export type SmsTemplateKind = keyof typeof smsTemplates
