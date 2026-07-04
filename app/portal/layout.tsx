import type { Metadata, Viewport } from "next"

// Portal-scoped PWA setup: installing from any /portal page gives an
// app-like Care Club icon that opens standalone.
export const metadata: Metadata = {
  manifest: "/portal-manifest.json",
  appleWebApp: {
    capable: true,
    title: "Care Club",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children
}

export const dynamic = "force-dynamic"
