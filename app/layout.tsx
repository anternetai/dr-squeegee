import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-brand-display",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const outfit = Outfit({
  variable: "--font-brand-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.drsqueegeeclt.com"),
  title: "Dr. Squeegee | Professional House Washing",
  description:
    "Charlotte's trusted pressure washing specialist. House washing, driveways, patios — done right, every time.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Dr. Squeegee — House Calls for a Cleaner Home",
    description:
      "Charlotte's trusted pressure washing specialist. Free estimates, licensed & insured.",
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
    <html lang="en">
      <head>
        <meta name="msvalidate.01" content="F77839BA725F86AAFF9906E2805D09C1" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${outfit.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
