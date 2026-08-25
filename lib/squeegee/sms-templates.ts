// SMS copy. Kept deliberately close to the message_samples registered on the
// A2P campaign (quote follow-ups, appointment reminders, service updates,
// invoices) so every send matches what the carrier approved.
//
// LINK-BEARING TEMPLATES RETURN TWO MESSAGES, NOT ONE.
//
// A URL sitting inside a sentence fails on real phones in two ways:
//   1. iMessage only draws a rich preview card when the message body is *just*
//      the URL. Any surrounding prose demotes it to a plain blue link, and the
//      customer never sees the branded Dr. Squeegee card.
//   2. Punctuation touching the URL ("...link: https://x/q/abc." ) gets pulled
//      into the href by Android/RCS linkifiers, so tapping it 404s. And any
//      smart punctuation anywhere in the body flips the whole message to UCS-2,
//      splitting it into segments the handset must rejoin — which is where
//      auto-detection stops producing a tappable link at all.
//
// So: { body } goes out first (opt-out language rides here, matching the A2P
// samples), then { link } goes out as a second message containing nothing but
// the URL. sendSmsWithLink() in sms.ts sends the pair in order.
//
// This file stays import-free so scripts/test-sms-links.mjs can load it directly.

const SITE = "https://www.drsqueegeeclt.com"
const CALL = "(704) 286-9696"

/** A message that carries a link: prose first, bare URL second. */
export interface LinkedSms {
  body: string
  link: string
}

function first(name: string | null | undefined): string {
  return (name || "there").trim().split(/\s+/)[0]
}

function money(n: number): string {
  return `$${Number(n).toFixed(2)}`
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
  quoteReady(name: string | null, token: string): LinkedSms {
    return {
      body: `Dr. Squeegee: Hi ${first(name)}, your quote is ready - tap the link below to view it. Reply here with any questions. Reply STOP to opt out.`,
      link: `${SITE}/q/${token}`,
    }
  },

  quoteFollowup(name: string | null, token: string): LinkedSms {
    return {
      body: `Dr. Squeegee: Hi ${first(name)}, just following up on your quote - still happy to get you on the schedule. Your quote is below. Reply STOP to opt out.`,
      link: `${SITE}/q/${token}`,
    }
  },

  // whenLabel e.g. "tomorrow at 8:30 AM" / "today at 9 AM". No link, so this one
  // stays a plain string.
  appointmentReminder(name: string | null, service: string, whenLabel: string): string {
    return `Dr. Squeegee: Reminder - we're scheduled for your ${service.toLowerCase()} ${whenLabel}. Reply YES to confirm or call ${CALL} to reschedule. Reply STOP to opt out.`
  },

  invoice(name: string | null, token: string): LinkedSms {
    return {
      body: `Dr. Squeegee: Thanks for having us out, ${first(name)}! Your invoice and secure payment link are below. Reply STOP to opt out.`,
      link: `${SITE}/q/${token}`,
    }
  },

  // Sent once payment clears. The receipt lives at its own permanent URL so the
  // customer can pull it up any time for their records.
  receipt(name: string | null, receiptToken: string, totalPaid: number): LinkedSms {
    return {
      body: `Dr. Squeegee: Payment received - thank you, ${first(name)}! Your receipt for ${money(totalPaid)} is below. Reply STOP to opt out.`,
      link: `${SITE}/r/${receiptToken}`,
    }
  },

  // Sent the moment a quote is accepted. whenLabel set = appointment already on
  // the job (formatApptLabel output); null = not scheduled yet. calUrl adds the
  // one-tap add-to-calendar link when it's a booked appointment — and when
  // there's no calUrl there's no link, so this returns a plain string instead.
  quoteAccepted(name: string | null, whenLabel: string | null, calUrl?: string): LinkedSms | string {
    if (whenLabel && calUrl) {
      return {
        body: `Dr. Squeegee: Thanks for accepting, ${first(name)}! You're on the schedule for ${whenLabel}. Add it to your calendar below. Reply STOP to opt out.`,
        link: calUrl,
      }
    }
    if (whenLabel) {
      return `Dr. Squeegee: Thanks for accepting, ${first(name)}! You're on the schedule for ${whenLabel}. Reply STOP to opt out.`
    }
    return `Dr. Squeegee: Thanks for accepting, ${first(name)}! We'll text you shortly to confirm your appointment time. Reply STOP to opt out.`
  },

  // Sent the moment a job is scheduled/rescheduled — distinct from the
  // day-before appointmentReminder above. calUrl = one-tap add-to-calendar link.
  appointmentConfirmed(name: string | null, service: string, whenLabel: string, calUrl?: string): LinkedSms | string {
    if (calUrl) {
      return {
        body: `Dr. Squeegee: You're confirmed for your ${service.toLowerCase()} ${whenLabel}. Add it to your calendar below, or call ${CALL} to reschedule. Reply STOP to opt out.`,
        link: calUrl,
      }
    }
    return `Dr. Squeegee: You're confirmed for your ${service.toLowerCase()} ${whenLabel}. Need to reschedule? Call ${CALL}. Reply STOP to opt out.`
  },

  reviewRequest(name: string | null, reviewUrl: string): LinkedSms {
    return {
      body: `Dr. Squeegee: Thanks again, ${first(name)}! If we did right by you, a quick review would mean a lot - link below. Reply STOP to opt out.`,
      link: reviewUrl,
    }
  },

  // Win-back to a PAST customer who previously consented — never a cold number.
  reengage(name: string | null): string {
    return `Dr. Squeegee: Hi ${first(name)}, it's been a while! Ready to get your home looking sharp again? Reply here or call ${CALL} for a quick quote. Reply STOP to opt out.`
  },
}

export type SmsTemplateKind = keyof typeof smsTemplates
