import type { Metadata } from "next"
import { Playfair_Display, Lora, Caveat } from "next/font/google"
import "./globals.css"

const playfair = Playfair_Display({
  variable: "--font-bb-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
})

const lora = Lora({
  variable: "--font-bb-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const caveat = Caveat({
  variable: "--font-bb-accent",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  metadataBase: new URL("https://drsqueegeeclt.com"),
  title: "The Bumblebread Club — Weekly Small-Batch Sourdough",
  description:
    "A microbakery offering weekly limited sourdough loaves. Join the club.",
  icons: {
    icon: "/bumblebread/wordmark.jpg",
  },
  openGraph: {
    title: "The Bumblebread Club — Weekly Small-Batch Sourdough",
    description:
      "A microbakery offering weekly limited sourdough loaves. Join the club.",
    url: "https://drsqueegeeclt.com/bumblebread",
    siteName: "The Bumblebread Club",
    type: "website",
    images: [
      {
        url: "/bumblebread/logo-full.jpg",
        width: 800,
        height: 600,
        alt: "The Bumblebread Club",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Bumblebread Club — Weekly Small-Batch Sourdough",
    description:
      "A microbakery offering weekly limited sourdough loaves. Join the club.",
  },
}

export default function BumblebreadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className={`${playfair.variable} ${lora.variable} ${caveat.variable} antialiased`}
      style={{ backgroundColor: "var(--bb-cream)", color: "var(--bb-navy)" }}
    >
      {children}
    </div>
  )
}
