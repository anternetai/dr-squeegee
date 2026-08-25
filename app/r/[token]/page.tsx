import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import { getReceiptByToken } from "@/lib/squeegee/receipt"
import { ReceiptView } from "./receipt-view"

interface PageProps {
  params: Promise<{ token: string }>
}

// noindex keeps a customer's name, address and price out of search results.
// It does NOT stop link-preview fetchers — those are allowed through robots.ts
// so a texted receipt still arrives with a Dr. Squeegee card on it.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const ogImageUrl = `https://www.drsqueegeeclt.com/r/${token}/opengraph-image`

  return {
    metadataBase: new URL("https://www.drsqueegeeclt.com"),
    title: "Your Receipt – Dr. Squeegee",
    description: "Payment receipt from Dr. Squeegee — House Calls for a Cleaner Home.",
    robots: { index: false, follow: false },
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      title: "Dr. Squeegee — Payment Receipt",
      description: "Paid in full. Thank you for your business!",
      siteName: "Dr. Squeegee",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: "Dr. Squeegee — Payment Receipt" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Dr. Squeegee — Payment Receipt",
      description: "Paid in full. Thank you for your business!",
      images: [ogImageUrl],
    },
  }
}

export default async function ReceiptPage({ params }: PageProps) {
  const { token } = await params
  const receipt = await getReceiptByToken(token)

  if (!receipt) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[#FEFCF7] p-4"
        style={{ fontFamily: "var(--font-brand-body), sans-serif" }}
      >
        <div className="text-center">
          <p className="text-4xl mb-4">&#128269;</p>
          <h1
            className="text-xl font-bold text-[#2B2B2B] mb-2"
            style={{ fontFamily: "var(--font-brand-display), serif" }}
          >
            Receipt Not Found
          </h1>
          <p className="text-[#2B2B2B]/50 text-sm">
            This link may have expired, or the invoice has not been paid yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ReceiptView receipt={receipt} />
    </ThemeProvider>
  )
}
