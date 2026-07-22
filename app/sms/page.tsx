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

export default function SmsProgram() {
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
        <p className="text-[#2B2B2B]/50 mb-10">Program disclosures — last updated July 16, 2026</p>

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
            The Opt-In Form
          </h2>
          <p>
            This is the exact contact step of our quote form where SMS consent is collected. View it live:{" "}
            <a href="/get-quote?step=contact" className="underline text-[#3A6B4C]">
              drsqueegeeclt.com/get-quote?step=contact
            </a>
            . The checkbox is unchecked by default and optional.
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
