// SMS copy. Kept deliberately close to the message_samples registered on the
// A2P campaign (quote follow-ups, appointment reminders, service updates,
// invoices) so every send matches what the carrier approved. The send helper
// guarantees the STOP line, but we include it here too to mirror the samples.

const SITE = "https://www.drsqueegeeclt.com"
const CALL = "(980) 242-8048"

function first(name: string | null | undefined): string {
  return (name || "there").trim().split(/\s+/)[0]
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

  reviewRequest(name: string | null, reviewUrl: string): string {
    return `Dr. Squeegee: Thanks again, ${first(name)}! If we did right by you, a quick review would mean a lot: ${reviewUrl} Reply STOP to opt out.`
  },

  // Win-back to a PAST customer who previously consented — never a cold number.
  reengage(name: string | null): string {
    return `Dr. Squeegee: Hi ${first(name)}, it's been a while! Ready to get your home looking sharp again? Reply here or call ${CALL} for a quick quote. Reply STOP to opt out.`
  },
}

export type SmsTemplateKind = keyof typeof smsTemplates
