import type { Metadata, Viewport } from "next"

// Crew field portal — standalone dark mobile app, no CRM shell. Techs install it
// to their home screen and work jobs from it. Always dark (brand), regardless of
// system theme, so we use explicit colors rather than the next-themes toggle.
export const metadata: Metadata = {
  title: "Dr. Squeegee | Crew",
  description: "Dr. Squeegee crew portal — your jobs, your schedule.",
  robots: { index: false, follow: false },
  manifest: "/crm-manifest.json",
  appleWebApp: {
    capable: true,
    title: "Squeegee Crew",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
}

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" style={{ colorScheme: "dark" }}>
      {children}
    </div>
  )
}
