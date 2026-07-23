import type { Metadata } from "next"
import { Phone } from "lucide-react"

export const metadata: Metadata = {
  title: "SMS Program | Dr. Squeegee House Washing",
  description:
    "Dr. Squeegee SMS program disclosures: how customers opt in, message types, frequency, rates, and how to opt out.",
  alternates: {
    canonical: "https://www.drsqueegeeclt.com/sms",
  },
}

export default async function SmsProgram({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; error?: string }>
}) {
  const sp = await searchParams
  return (
    <div className="min-h-screen bg-[#FEFCF7] text-[#2B2B2B]" style={{ fontFamily: "var(--font-brand-body), sans-serif" }}>
      <header className="border-b border-[#3A6B4C]/10 bg-[#FEFCF7]/90">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
          <a href="/get-quote">
            <img src="/images/squeegee/wordmark.png" alt="Dr. Squeegee" className="h-8" />
          </a>
          <a href="tel:+19802428048" className="flex items-center gap-1.5 text-sm font-medium text-[#3A6B4C]">
            <Phone className="h-4 w-4" />
            (980) 242-8048
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-16">
        <h1 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-3xl md:text-4xl font-bold mb-2 text-[#2B2B2B]">
          Dr. Squeegee SMS Program
        </h1>
        <p className="text-[#2B2B2B]/50 mb-10">Program disclosures — last updated July 22, 2026</p>

        {/* Standalone opt-in form — a plain no-JavaScript HTML form so the full
            consent CTA is visible and submittable at this exact URL for both
            customers and A2P carrier reviewers (the URL cited as the primary
            opt-in in the campaign MessageFlow). */}
        <section id="signup" className="mb-14 rounded-2xl border border-[#3A6B4C]/20 bg-white p-6 md:p-8 shadow-sm">
          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] mb-1">
            Sign Up for Text Updates
          </h2>
          <p className="text-[#2B2B2B]/60 mb-5 text-sm">
            Get quote follow-ups, appointment reminders, and service updates by text. Optional — never required to buy.
          </p>
          {sp?.subscribed === "1" && (
            <div className="mb-5 rounded-lg bg-[#3A6B4C]/10 border border-[#3A6B4C]/30 px-4 py-3 text-[#3A6B4C] text-sm">
              You&apos;re signed up. We&apos;ll text you from (980) 242-8048. Reply STOP any time to opt out.
            </div>
          )}
          {sp?.error === "1" && (
            <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
              Please enter a valid phone number and check the consent box to sign up.
            </div>
          )}
          <form action="/api/squeegee/sms-optin" method="POST" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="optin-name" className="block text-sm font-medium text-[#2B2B2B] mb-1">Name</label>
                <input id="optin-name" name="name" type="text" placeholder="Your name" className="w-full rounded-lg border border-[#3A6B4C]/25 bg-[#FEFCF7] px-3.5 py-2.5 text-[#2B2B2B] placeholder:text-[#2B2B2B]/35 focus:outline-none focus:border-[#3A6B4C]" />
              </div>
              <div>
                <label htmlFor="optin-phone" className="block text-sm font-medium text-[#2B2B2B] mb-1">Mobile phone <span className="text-red-500">*</span></label>
                <input id="optin-phone" name="phone" type="tel" required placeholder="(704) 555-1234" className="w-full rounded-lg border border-[#3A6B4C]/25 bg-[#FEFCF7] px-3.5 py-2.5 text-[#2B2B2B] placeholder:text-[#2B2B2B]/35 focus:outline-none focus:border-[#3A6B4C]" />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <input id="optin-consent" name="sms_consent" type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#3A6B4C]" />
              <label htmlFor="optin-consent" className="text-xs text-[#2B2B2B]/70 leading-relaxed">
                I agree to receive recurring SMS text messages from Dr. Squeegee at the number provided (quote
                follow-ups, appointment reminders, service updates, invoices). Msg frequency varies. Msg &amp; data
                rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase. See our{" "}
                <a href="/privacy" className="underline text-[#3A6B4C]">Privacy Policy</a> and{" "}
                <a href="/terms" className="underline text-[#3A6B4C]">Terms of Service</a>.
              </label>
            </div>
            <button type="submit" className="w-full sm:w-auto rounded-lg bg-[#3A6B4C] px-6 py-3 font-semibold text-white hover:bg-[#2F5A3F] transition-colors">
              Sign Me Up for Texts
            </button>
          </form>
        </section>

        <div className="prose prose-lg max-w-none space-y-6 text-[#2B2B2B]/80">
          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            Program Description
          </h2>
          <p>
            Dr. Squeegee House Washing (Dr Squeegee Window Cleaning LLC) sends text messages to customers and
            quote requesters in the Charlotte, NC area. Messages include service quote follow-ups, appointment
            confirmations and reminders, service updates, and invoices with secure payment links. This is a
            conversational, low-volume program between our company and its own customers only.
          </p>

          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            How You Opt In
          </h2>
          <p>
            Customers opt in one of two ways:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Online:</strong> when requesting a quote at{" "}
              <a href="/get-quote" className="underline text-[#3A6B4C]">drsqueegeeclt.com/get-quote</a>, you may
              enter your phone number and check an optional, unchecked consent box that reads: &quot;I agree to
              receive SMS text messages from Dr. Squeegee at the number provided (quote follow-ups, reminders,
              service updates). Msg frequency varies. Msg &amp; data rates may apply. Reply STOP to opt out. See
              our Privacy Policy &amp; Terms.&quot;
            </li>
            <li>
              <strong>In person:</strong> customers may verbally request quote or appointment texts while booking
              service; the first message confirms the opt-in and includes opt-out instructions.
            </li>
          </ul>
          <p>Consent to receive text messages is optional and is not a condition of purchasing any service.</p>

          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            The Opt-In Forms
          </h2>
          <p>
            The consent form at the top of this page (<a href="#signup" className="underline text-[#3A6B4C]">Sign Up for Text Updates</a>)
            is our primary opt-in. The same unchecked, optional consent checkbox also appears on the contact step of
            our quote form — view it live at{" "}
            <a href="/get-quote?step=contact" className="underline text-[#3A6B4C]">
              drsqueegeeclt.com/get-quote?step=contact
            </a>
            :
          </p>
          <img
            src="/images/sms/optin-step.png"
            alt="Dr. Squeegee quote form contact step showing the optional, unchecked SMS consent checkbox and its full consent language"
            className="w-full max-w-xl rounded-lg border border-[#3A6B4C]/20 shadow-sm"
          />

          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            Message Frequency &amp; Rates
          </h2>
          <p>
            Message frequency varies based on your service activity (typically 1–4 messages around a quote or
            appointment). Message and data rates may apply according to your mobile carrier plan.
          </p>

          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            Opt Out &amp; Help
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Reply <strong>STOP</strong> to any message to unsubscribe from all messages.</li>
            <li>
              Reply <strong>HELP</strong> for assistance, or contact customer care at (980) 242-8048 or
              anthony@drsqueegeeclt.com.
            </li>
          </ul>

          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            Privacy
          </h2>
          <p>
            No mobile information will be shared with third parties or affiliates for marketing or promotional
            purposes. Text messaging originator opt-in data and consent will not be shared with any third
            parties, except as necessary for aggregators and providers of the text messaging services used to
            deliver messages to you. Full details:{" "}
            <a href="/privacy" className="underline text-[#3A6B4C]">Privacy Policy</a> and{" "}
            <a href="/terms" className="underline text-[#3A6B4C]">Terms of Service</a>.
          </p>
        </div>
      </main>
    </div>
  )
}
