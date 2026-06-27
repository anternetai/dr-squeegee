// Dr. Squeegee — Brand Constants
// "The house-call doctor for your home's exterior."

export const BRAND = {
  name: "Dr. Squeegee",
  tagline: "House Calls for a Cleaner Home",
  taglineSecondary: "Charlotte's Pressure Washing Specialist",
  phone: "(980) 242-8048",
  phoneTel: "+19802428048",
  address: "8623 Longnor St, Charlotte, NC 28214",
  entity: "Dr. Squeegee LLC",
  domain: "drsqueegeeclt.com",
} as const

// Color palette — black + white + teal
export const COLORS = {
  teal: "#2D8C6F",          // Primary accent — buttons, icons, borders
  tealDark: "#1F6B54",      // Hover/pressed teal
  tealLight: "#E6F5F0",     // Light teal bg (active nav, badges)
  black: "#0A0A0A",         // Page backgrounds, panels
  panelDark: "#111111",     // Dark card/panel
  panelMid: "#1A1A1A",      // Mid panel
  border: "#242424",        // Panel borders
  white: "#FFFFFF",         // Text on dark, card backgrounds
  mutedText: "#9CA3AF",     // Secondary text
  charcoal: "#1A1A1A",      // Body text on light bg
  brickRed: "#B8453A",      // Decline / destructive (sparingly)
} as const

// Font families (CSS variable names from layout.tsx)
export const FONTS = {
  display: "var(--font-brand-display)", // Fraunces — headings, brand name, prices
  body: "var(--font-brand-body)",       // Outfit — body text, UI, buttons
} as const
