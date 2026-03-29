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

// Color palette
export const COLORS = {
  green: "#3A6B4C",       // Primary — buttons, headers, accents
  greenDark: "#2F5A3F",   // Hover state
  cream: "#F5F0E1",       // Backgrounds, cards
  gold: "#C8973E",        // Accent borders, badges, premium details
  charcoal: "#2B2B2B",    // Body text, dark sections
  warmWhite: "#FEFCF7",   // Page backgrounds
  brickRed: "#B8453A",    // CTA highlights (sparingly)

  // Derived / UI shades
  greenLight: "#E8F0EA",    // Light green bg (active nav, badges)
  greenLighter: "#F2F7F3",  // Very light green bg (calendar today)
  greenDarkText: "#1E3E2B", // Dark green for text on light bg
  greenDarkBg: "#1A2E21",   // Dark mode active bg
  greenDarkerBg: "#152419",  // Dark mode revenue card bg
  greenDarkestBg: "#121E16", // Dark mode calendar today bg
  greenDarkHeader: "#182A1E",// Dark mode calendar today header
  greenMutedText: "#A8C4B0", // Light green text on dark bg
  greenMidText: "#234A32",   // Mid-dark green text
  greenBorder: "#C8D8CE",    // Light green border
  greenDarkBorder: "#1E3E2B",// Dark mode border
} as const

// Font families (CSS variable names from layout.tsx)
export const FONTS = {
  display: "var(--font-brand-display)", // Fraunces — headings, brand name, prices
  body: "var(--font-brand-body)",       // Outfit — body text, UI, buttons
} as const
