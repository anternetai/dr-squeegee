import type { Metadata } from "next"

export const metadata: Metadata = {
  metadataBase: new URL("https://www.drsqueegeeclt.com"),
  title: "Dr. Squeegee | Window Cleaning Charlotte NC | Free Quote",
  description:
    "Charlotte's trusted window cleaning specialist. Streak-free interior & exterior windows on a simple monthly, quarterly, or weekly plan. Pressure washing add-ons available. Free quote today.",
  keywords: ["window cleaning Charlotte NC", "window cleaners Charlotte", "residential window cleaning Charlotte", "commercial window cleaning Charlotte", "window washing near me", "storefront window cleaning Charlotte", "pressure washing Charlotte NC", "house washing Charlotte"],
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
    title: "Dr. Squeegee — Streak-Free Windows, Every Time",
    description:
      "Charlotte's trusted window cleaning specialist. Recurring plans, free estimates, licensed & insured.",
    siteName: "Dr. Squeegee",
    type: "website",
    url: "https://www.drsqueegeeclt.com/get-quote",
    images: [{ url: "/get-quote/opengraph-image", width: 1200, height: 630, alt: "Dr. Squeegee — Window Cleaning Charlotte NC" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dr. Squeegee | Window Cleaning Charlotte NC",
    description: "Charlotte's trusted window cleaning specialist. Recurring plans, free estimates, licensed & insured.",
    images: ["/get-quote/opengraph-image"],
  },
}

export default function GetQuoteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0C120F] text-white antialiased" style={{ fontFamily: "var(--font-brand-body), sans-serif" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "@id": "https://www.drsqueegeeclt.com/#business",
            "name": "Dr. Squeegee",
            "description": "Professional window cleaning in Charlotte, NC — streak-free interior & exterior glass on recurring monthly, quarterly, and weekly plans. Plus house washing and pressure washing.",
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
              "name": "Window Cleaning & Exterior Services",
              "itemListElement": [
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Window Cleaning",
                    "description": "Streak-free interior and exterior window cleaning, including screens and sills, on recurring monthly, quarterly, or weekly plans.",
                  },
                },
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Commercial Window Cleaning",
                    "description": "Storefront and office glass cleaning on weekly or bi-weekly routes.",
                  },
                },
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
                    "name": "Pressure Washing",
                    "description": "Driveways, patios, pool decks, and pavers — available as an add-on.",
                  },
                },
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Solar Panel Cleaning",
                    "description": "Removes dust, pollen, and droppings to restore solar panel efficiency.",
                  },
                },
                {
                  "@type": "Offer",
                  "itemOffered": {
                    "@type": "Service",
                    "name": "Gutter Cleaning",
                    "description": "Clears leaves, debris, and sludge so gutters drain properly and prevent water damage.",
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
