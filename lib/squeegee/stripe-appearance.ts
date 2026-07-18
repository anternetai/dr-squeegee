import type { Appearance } from "@stripe/stripe-js"
import { COLORS } from "@/lib/squeegee/brand"

// Stripe Elements is rendered in an iframe and cannot read our Tailwind theme
// classes — it needs its own appearance object. Build one per resolved theme so
// the card fields match the charcoal/teal brand in both light and dark mode.
export function stripeAppearance(theme: "light" | "dark"): Appearance {
  const dark = theme === "dark"
  return {
    theme: dark ? "night" : "stripe",
    variables: {
      colorPrimary: COLORS.teal,
      colorBackground: dark ? "#111111" : "#FFFFFF",
      colorText: dark ? "#FFFFFF" : COLORS.charcoal,
      colorTextSecondary: COLORS.mutedText,
      colorDanger: COLORS.brickRed,
      fontFamily: "Outfit, system-ui, sans-serif",
      borderRadius: "12px",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": {
        border: `1px solid ${dark ? "#242424" : "rgba(45,140,111,0.20)"}`,
        boxShadow: "none",
      },
      ".Input:focus": {
        border: `1px solid ${COLORS.teal}`,
        boxShadow: `0 0 0 1px ${COLORS.teal}`,
      },
      ".Tab, .Block": {
        border: `1px solid ${dark ? "#242424" : "rgba(45,140,111,0.20)"}`,
      },
      ".Tab--selected": {
        border: `1px solid ${COLORS.teal}`,
      },
      ".Label": {
        color: dark ? "#FFFFFF" : COLORS.charcoal,
      },
    },
  }
}

// Google Fonts source so the Elements iframe can render Outfit.
export const STRIPE_ELEMENT_FONTS = [
  { cssSrc: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" },
]

export interface TipTier {
  label: string
  value: number // dollars; 0 = no tip
}

// Flat-dollar tip anchors scaled to the invoice total. Percentage tipping on a
// several-hundred-dollar home-service job reads greedy and depresses conversion,
// so we offer round-dollar quick-adds instead, with "No tip" as an equal-weight
// first option. A custom input (handled in the component) covers everything else.
export function tipTiers(total: number): TipTier[] {
  let anchors: number[]
  if (total < 150) anchors = [10, 20, 30]
  else if (total <= 400) anchors = [15, 25, 40]
  else anchors = [25, 50, 75]
  return [{ label: "No tip", value: 0 }, ...anchors.map((v) => ({ label: `$${v}`, value: v }))]
}

// Upper bound on a custom tip: guards fat-finger entries and card-testing abuse.
export function maxTip(total: number): number {
  return Math.min(total, 500)
}
