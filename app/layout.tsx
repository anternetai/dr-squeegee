import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Condensed, athletic — matches the embroidered badge lettering exactly
const oswald = Oswald({
  variable: "--font-brand-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-brand-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.drsqueegeeclt.com"),
  title: "Dr. Squeegee | Window Cleaning Charlotte NC",
  description:
    "Charlotte's window cleaning specialists. Streak-free windows, house washing, driveways — licensed & insured.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Dr. Squeegee — Streak-Free Windows, Every Time",
    description:
      "Charlotte's window cleaning specialists. Homes & businesses. Free quotes, licensed & insured.",
    url: "https://www.drsqueegeeclt.com",
    siteName: "Dr. Squeegee",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // next-themes writes className/color-scheme onto <html> on the client, which
    // the server cannot know about. suppressHydrationWarning covers that one
    // attribute diff on this element only — it is not a blanket silencer.
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="msvalidate.01" content="F77839BA725F86AAFF9906E2805D09C1" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${oswald.variable} ${outfit.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
