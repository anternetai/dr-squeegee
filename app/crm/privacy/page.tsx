import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy | Dr. Squeegee House Washing",
  description: "Dr. Squeegee House Washing privacy policy - how we collect, use, and protect your information.",
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-900 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/get-quote" className="text-slate-400 hover:text-white text-sm">&larr; Back to Home</Link>
          <h1 className="text-3xl font-bold mt-2">Privacy Policy</h1>
          <p className="text-slate-400 mt-1">Last updated: March 1, 2026</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 prose prose-slate">
        <h2>Introduction</h2>
        <p>
          Dr. Squeegee House Washing (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides professional
          exterior cleaning services, including house washing, pressure washing, driveway cleaning, surface
          cleaning, and related services in the Charlotte, NC area. This Privacy Policy explains how we collect,
          use, disclose, and safeguard your information when you interact with our services, including through
          our website (drsqueegeeclt.com) and text message (SMS) communications.
        </p>

        <h2>Information We Collect</h2>
        <p>We may collect the following personal information:</p>
        <ul>
          <li><strong>Contact Information:</strong> Name, phone number, email address</li>
          <li><strong>Service Details:</strong> Type of service requested, property address, property type, project timeline</li>
          <li><strong>Communication Records:</strong> Records of text messages, phone calls, and other communications between you and our team</li>
          <li><strong>Device &amp; Usage Data:</strong> Browser type, IP address, and website interaction data collected via cookies and analytics tools</li>
        </ul>

        <h2>How We Collect Your Information</h2>
        <p>We collect information through:</p>
        <ul>
          <li><strong>Our Website:</strong> When you fill out a quote request form on drsqueegeeclt.com</li>
          <li><strong>Phone &amp; SMS:</strong> When you call us, text us, or respond to our text messages</li>
          <li><strong>In-Person Inquiries:</strong> When you contact us directly to request a service estimate</li>
        </ul>

        <h2>How We Use Your Information</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide you with service estimates and quotes</li>
          <li>Schedule and confirm appointments</li>
          <li>Send you text messages (SMS) related to your service inquiry, appointment scheduling, and follow-ups</li>
          <li>Make phone calls to discuss your project</li>
          <li>Improve our services and customer experience</li>
          <li>Comply with legal obligations</li>
        </ul>

        <h2>Text Messaging (SMS) Policy</h2>
        <p>
          By providing your phone number and checking the SMS consent box on our website quote request form,
          you consent to receive text messages from Dr. Squeegee House Washing. Messages may include:
        </p>
        <ul>
          <li>Service quotes and estimates</li>
          <li>Appointment confirmations and reminders</li>
          <li>Job status updates</li>
          <li>Follow-up messages regarding your service</li>
          <li>Responses to your questions</li>
        </ul>
        <p>
          <strong>Message frequency varies</strong> based on your service interactions. Message and data
          rates may apply. You can opt out at any time by replying <strong>STOP</strong> to any text
          message. Reply <strong>HELP</strong> for assistance, or contact us at (980) 242-8048 or
          anthony@drsqueegeeclt.com.
        </p>
        <p>
          Consent to receive text messages is not a condition of purchasing any goods or services from
          Dr. Squeegee House Washing.
        </p>
        <p>
          We do not send unsolicited marketing text messages. All SMS communications are directly related to
          a service inquiry, quote, or appointment that you initiated.
        </p>

        <h2>Sharing Your Information</h2>
        <p>We may share your information with:</p>
        <ul>
          <li><strong>Service Providers:</strong> Third-party tools we use to facilitate communications (e.g., SMS delivery platforms, payment processors)</li>
          <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process</li>
        </ul>
        <p>
          <strong>We do not sell, rent, or share your personal information with third parties or affiliates
          for marketing or promotional purposes.</strong>
        </p>
        <p>
          <strong>No mobile information will be shared with third parties or affiliates for marketing or
          promotional purposes.</strong> Text messaging originator opt-in data and consent will not be shared
          with any third parties, except as necessary for aggregators and providers of the text messaging
          services used to deliver messages to you.
        </p>
        <p>
          All of the above categories exclude text messaging originator opt-in data and consent; this
          information will not be shared with any third parties.
        </p>

        <h2>Data Security</h2>
        <p>
          We implement reasonable technical and organizational measures to protect your personal information.
          However, no method of electronic transmission or storage is 100% secure, and we cannot guarantee
          absolute security.
        </p>

        <h2>Data Retention</h2>
        <p>
          We retain your personal information only for as long as necessary to fulfill the purposes outlined
          in this policy, or as required by law. You may request deletion of your data at any time by
          contacting us.
        </p>

        <h2>Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Request access to the personal information we hold about you</li>
          <li>Request correction or deletion of your personal information</li>
          <li>Opt out of text message communications at any time by replying <strong>STOP</strong></li>
          <li>Opt out of email communications by contacting us directly</li>
          <li>Request information about what data we have collected about you</li>
        </ul>

        <h2>Children&apos;s Privacy</h2>
        <p>
          Our services are not directed to individuals under 18. We do not knowingly collect personal
          information from children.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of changes by updating
          the &quot;Last updated&quot; date at the top of this policy. Changes will be posted on this page.
        </p>

        <h2>Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy, wish to exercise your rights, or need assistance
          with text message communications, contact us at:
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
