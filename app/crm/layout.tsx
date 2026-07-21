import type { Metadata, Viewport } from "next"
import { ThemeProvider } from "next-themes"
import { CrmShell } from "@/components/squeegee/crm-shell"

// CRM-scoped PWA setup: installing from any /crm page (Anthony's home-screen
// shortcut) gives an app-like standalone window instead of opening Safari/Chrome.
export const metadata: Metadata = {
  title: "Dr. Squeegee | CRM",
  description: "Internal job management portal for Dr. Squeegee — House Calls for a Cleaner Home.",
  robots: { index: false, follow: false },
  manifest: "/crm-manifest.json",
  appleWebApp: {
    capable: true,
    title: "Squeegee CRM",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Dr. Squeegee",
    description: "House Calls for a Cleaner Home",
    siteName: "Dr. Squeegee",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
}

export default function SqueegeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <CrmShell>{children}</CrmShell>
    </ThemeProvider>
  )
}
