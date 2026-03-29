import type { Metadata } from "next"

export const metadata: Metadata = {
  metadataBase: new URL("https://www.drsqueegeeclt.com"),
  title: "Dr. Squeegee | Pressure Washing Charlotte NC | Free Quote",
  description:
    "Charlotte's trusted pressure washing specialist. House washing, driveways, patios — done right, every time. Get your free quote today.",
  keywords: ["pressure washing Charlotte NC", "house washing Charlotte", "power washing Charlotte NC", "driveway cleaning Charlotte", "patio cleaning Charlotte NC", "pressure washing near me", "exterior cleaning Charlotte"],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: "https://www.drsqueegeeclt.com/get-quote",
  },
  openGraph: {
    title: "Dr. Squeegee — House Calls for a Cleaner Home",
    description:
      "Charlotte's trusted pressure washing specialist. Free estimates, licensed & insured.",
    siteName: "Dr. Squeegee",
    type: "website",
    url: "https://www.drsqueegeeclt.com/get-quote",
    images: [{ url: "/get-quote/opengraph-image", width: 1200, height: 630, alt: "Dr. Squeegee — Pressure Washing Charlotte NC" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dr. Squeegee | Pressure Washing Charlotte NC",
    description: "Charlotte's trusted pressure washing specialist. Free estimates, licensed & insured.",
    images: ["/get-quote/opengraph-image"],
  },
}

export default function GetQuoteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#FEFCF7] text-[#2B2B2B] antialiased" style={{ fontFamily: "var(--font-brand-body), sans-serif" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "@id": "https://www.drsqueegeeclt.com/#business",
            "name": "Dr. Squeegee",
            "description": "Professional pressure washing and house washing services in Charlotte, NC. Driveways, patios, siding, and more.",
            "url": "https://www.drsqueegeeclt.com/get-quote",
            "telephone": "+19802428048",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Charlotte",
              "addressRegion": "NC",
              "addressCountry": "US",
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": 35.2271,
              "longitude": -80.8431,
            },
            "areaServed": {
              "@type": "City",
              "name": "Charlotte",
              "sameAs": "https://en.wikipedia.org/wiki/Charlotte,_North_Carolina",
            },
            "priceRange": "$$",
            "image": "https://www.drsqueegeeclt.com/get-quote/opengraph-image",
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "5.0",
              "reviewCount": "6",
              "bestRating": "5",
              "worstRating": "1",
            },
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "Pressure Washing Services",
              "itemListElement": [
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "House Washing",
                    "description": "Soft wash exterior cleaning for siding, brick, and stucco.",
                  },
                },
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Driveway Cleaning",
                    "description": "High-pressure concrete and paver driveway cleaning.",
                  },
                },
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Patio & Deck Cleaning",
                    "description": "Pressure washing for patios, decks, and outdoor living spaces.",
                  },
                },
              ],
            },
          }),
        }}
      />
      {children}
    </div>
  )
}
