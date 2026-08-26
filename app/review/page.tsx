import type { Metadata } from "next"
import { ThemeProvider } from "next-themes"
import { ReviewClient } from "./review-client"

// Dr. Squeegee Home Cleaning's public place ID. Hardcoded so this never loops
// back through GOOGLE_REVIEW_URL, which points at this page.
const GOOGLE_WRITE_REVIEW =
  "https://search.google.com/local/writereview?placeid=ChIJx-3-oXqjVogRsQbP1aPSDF8"

// This replaced a bare 302 to Google. The redirect worked, but a redirect has no
// page for a link-preview fetcher to read, so every review text arrived as a
// naked grey URL with no Dr. Squeegee card on it. A real page fixes that and
// gives an unhappy customer somewhere to go that isn't a public review.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.drsqueegeeclt.com"),
  title: "How did we do? – Dr. Squeegee",
  description:
    "Leave Dr. Squeegee a Google review, or tell us directly if something wasn't right. Charlotte pressure washing and window cleaning.",
  alternates: { canonical: "/review" },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "How did we do? — Dr. Squeegee",
    description: "Thirty seconds of your time genuinely moves the needle for a small Charlotte crew.",
    siteName: "Dr. Squeegee",
    type: "website",
    url: "/review",
    images: [
      {
        url: "https://www.drsqueegeeclt.com/review/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Dr. Squeegee — How did we do?",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "How did we do? — Dr. Squeegee",
    description: "Thirty seconds of your time genuinely moves the needle for a small Charlotte crew.",
    images: ["https://www.drsqueegeeclt.com/review/opengraph-image"],
  },
}

export default function ReviewPage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ReviewClient googleUrl={GOOGLE_WRITE_REVIEW} />
    </ThemeProvider>
  )
}
