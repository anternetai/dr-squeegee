import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service | Dr. Squeegee House Washing",
  description: "Dr. Squeegee House Washing terms of service including SMS messaging terms.",
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-900 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/get-quote" className="text-slate-400 hover:text-white text-sm">&larr; Back to Home</Link>
          <h1 className="text-3xl font-bold mt-2">Terms of Service</h1>
          <p className="text-slate-400 mt-1">Last updated: March 1, 2026</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 prose prose-slate">
        <h2>Agreement to Terms</h2>
        <p>
          By accessing our website (drsqueegeeclt.com), submitting a quote request form, or communicating
          with us via text message or phone, you agree to be bound by these Terms of Service. If you do
          not agree, please do not use our services.
        </p>

        <h2>Description of Services</h2>
        <p>
          Dr. Squeegee House Washing (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides professional
          exterior cleaning services in the Charlotte, NC area. Our services include house washing, driveway
          cleaning, surface cleaning, pool deck cleaning, paver cleaning, and related pressure washing services.
        </p>

        <h2>SMS Terms of Service</h2>
        <p>
          The following terms apply to our text messaging (SMS) communications:
        </p>

        <h3>Program Description</h3>
        <p>
          Dr. Squeegee House Washing sends text messages to customers and prospective customers who have
          opted in to receive SMS communications. Messages include appointment confirmations, service
          reminders, quote follow-ups, job status updates, and customer service communications related to
          pressure washing and exterior cleaning services.
        </p>

        <h3>Opt-In</h3>
        <p>
          By providing your mobile phone number and checking the SMS consent checkbox on our website quote
          request form at drsqueegeeclt.com, you expressly consent to receive SMS text messages from
          Dr. Squeegee House Washing at the phone number you provided. You may also opt in by texting us
          first or verbally consenting during a phone call.
        </p>
        <p>
          <strong>Consent to receive text messages is not a condition of purchasing any goods or services.</strong>
        </p>

        <h3>Message Frequency</h3>
        <p>
          Message frequency varies based on your interaction with us and the status of your service request.
          You may receive messages related to your quote, appointment scheduling, job status, and follow-up
          communications. Typically, you will receive between 1-10 messages per service interaction.
        </p>

        <h3>Opt-Out</h3>
        <p>
          You can opt out of receiving text messages at any time by replying <strong>STOP</strong> to any
          message you receive from us. Upon receiving your STOP request, you will receive one final
          confirmation message, and no further messages will be sent. You may re-subscribe at any time
          by texting <strong>START</strong> or by submitting a new quote request on our website.
        </p>

        <h3>Help</h3>
        <p>
          For assistance with our text messaging service, reply <strong>HELP</strong> to any message,
          or contact us directly:
        </p>
        <ul>
          <li><strong>Phone:</strong> (980) 242-8048</li>
          <li><strong>Email:</strong> anthony@drsqueegeeclt.com</li>
        </ul>

        <h3>Message and Data Rates</h3>
        <p>
          Message and data rates may apply. Check with your mobile carrier for details about your text
          messaging plan. Dr. Squeegee House Washing is not responsible for any charges incurred from
          your carrier related to SMS messages.
        </p>

        <h3>Carrier Disclaimer</h3>
        <p>
          Carriers (T-Mobile, AT&amp;T, Verizon, etc.) are not liable for delayed or undelivered messages.
        </p>

        <h3>Privacy</h3>
        <p>
          Your privacy is important to us. We do not sell, rent, or share your mobile phone number or any
          personal information with third parties for marketing or promotional purposes. For full details
          on how we collect, use, and protect your information, see
          our <Link href="/crm/privacy">Privacy Policy</Link>.
        </p>

        <h2>Quotes and Pricing</h2>
        <p>
          Quotes provided through our website, text messages, or in-person estimates are good faith estimates
          based on the information available at the time. Final pricing may vary based on actual conditions
          observed during the service visit. We will communicate any price changes before proceeding with work.
        </p>

        <h2>Service Scheduling</h2>
        <p>
          Appointment times are subject to weather conditions and scheduling availability. We will make
          reasonable efforts to notify you of any changes to your scheduled appointment via text message
          or phone call.
        </p>

        <h2>Payment</h2>
        <p>
          Payment is due upon completion of services unless otherwise agreed upon in writing. We accept
          payment via credit/debit card through our secure online payment system. All sales are final once
          services have been rendered.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, Dr. Squeegee House Washing shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages arising out of your use of our
          services or website. Our total liability shall not exceed the amount you have paid us for the
          specific service giving rise to the claim.
        </p>

        <h2>Intellectual Property</h2>
        <p>
          All content on our website, including text, graphics, logos, images, and videos, is the property
          of Dr. Squeegee House Washing and is protected by applicable intellectual property laws.
        </p>

        <h2>Modifications</h2>
        <p>
          We reserve the right to modify these Terms at any time. Changes will be posted on this page with
          an updated date. Continued use of our services after changes constitutes acceptance of the
          updated Terms.
        </p>

        <h2>Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the laws of the State of
          North Carolina, without regard to conflict of law principles.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have questions about these Terms, contact us at:
        </p>
        <ul>
          <li><strong>Phone:</strong> (980) 242-8048</li>
          <li><strong>Email:</strong> anthony@drsqueegeeclt.com</li>
          <li><strong>Website:</strong> drsqueegeeclt.com</li>
          <li><strong>Address:</strong> 8623 Longnor St, Charlotte, NC 28214</li>
        </ul>
      </main>

      <footer className="bg-slate-900 text-white py-6 px-4 mt-12">
        <div className="max-w-3xl mx-auto text-center text-slate-400 text-sm">
          <p>&copy; {new Date().getFullYear()} Dr. Squeegee House Washing. All rights reserved.</p>
          <div className="mt-2 space-x-4">
            <Link href="/crm/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/crm/terms" className="hover:text-white">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
