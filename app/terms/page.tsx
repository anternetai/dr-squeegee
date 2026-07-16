import type { Metadata } from "next"
import { Phone } from "lucide-react"

export const metadata: Metadata = {
  title: "Terms of Service | Dr. Squeegee House Washing",
  description: "Dr. Squeegee House Washing terms of service, including SMS messaging terms.",
  alternates: {
    canonical: "https://www.drsqueegeeclt.com/terms",
  },
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#FEFCF7] text-[#2B2B2B]" style={{ fontFamily: "var(--font-brand-body), sans-serif" }}>
      {/* Header */}
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
          Terms of Service
        </h1>
        <p className="text-[#2B2B2B]/50 mb-10">Last updated: July 16, 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-[#2B2B2B]/80">
          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            Services
          </h2>
          <p>
            Dr. Squeegee House Washing (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides professional
            exterior cleaning services in the Charlotte, NC area, including window cleaning, house washing,
            pressure washing, roof and gutter cleaning, and driveway/surface cleaning. Quotes describe the
            services and pricing offered; work is scheduled and performed as agreed with the customer.
          </p>

          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            Quotes, Invoices &amp; Payment
          </h2>
          <p>
            Quotes are valid for 30 days unless stated otherwise. Once a quote is accepted or an agreement is
            signed, its pricing is locked for the described work. Invoices are payable upon completion unless
            other terms are agreed in writing. We accept card payments through our secure payment provider
            (Stripe), as well as cash and check.
          </p>

          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            SMS Messaging Terms
          </h2>
          <p>
            By checking the SMS consent box on our quote form, or by verbally requesting text updates, you
            consent to receive text messages from Dr. Squeegee at the phone number you provide. Messages
            include quote follow-ups, appointment confirmations and reminders, service updates, and invoices
            with payment links.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Message frequency varies based on your service activity.</li>
            <li>Message and data rates may apply, depending on your mobile carrier plan.</li>
            <li>
              Reply <strong>STOP</strong> at any time to opt out of all messages. Reply <strong>HELP</strong> for
              assistance, or contact us at (980) 242-8048 or anthony@drsqueegeeclt.com.
            </li>
            <li>Consent to receive text messages is not a condition of purchasing any service.</li>
            <li>
              No mobile information will be shared with third parties or affiliates for marketing or
              promotional purposes. See our{" "}
              <a href="/privacy" className="underline text-[#3A6B4C]">Privacy Policy</a> for full details on
              how we handle your information.
            </li>
            <li>Carriers are not liable for delayed or undelivered messages.</li>
          </ul>

          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            Liability
          </h2>
          <p>
            We are insured and take care to protect your property while performing services. Any concerns
            about completed work must be reported within 72 hours so we can make it right. Our liability for
            any claim is limited to the amount paid for the service giving rise to the claim.
          </p>

          <h2 style={{ fontFamily: "var(--font-brand-display), serif" }} className="text-2xl font-bold text-[#2B2B2B] pt-4">
            Contact
          </h2>
          <p>
            Dr. Squeegee House Washing
            <br />
            8623 Longnor St, Charlotte, NC 28214
            <br />
            (980) 242-8048 · anthony@drsqueegeeclt.com
          </p>
        </div>
      </main>
    </div>
  )
}
