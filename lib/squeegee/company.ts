// Dr. Squeegee — who we are. Single source of truth for the mission, values,
// and what's expected of crew. Used in onboarding and the /team Standards tab.
// Scriptures reference the New World Translation (Study Edition).

export const MISSION =
  "House calls for a cleaner home — done in a way that honors Jehovah, treats every customer right, and leaves every property better than we found it."

export interface CompanyValue {
  title: string
  body: string
  scripture?: string
}

// Five core values. #1 is the anchor. Bible-based; keep the count small so they
// actually get remembered.
export const VALUES: CompanyValue[] = [
  {
    title: "Leave it better than we found it",
    body: "Every home, every yard, every person we deal with is better for us having been there.",
  },
  {
    title: "Work whole-souled, as for Jehovah",
    body: "We give our best because the work honors Jehovah — not only the customer.",
    scripture: "Colossians 3:23",
  },
  {
    title: "Honest in all things",
    body: "Straight quotes, no cut corners, no surprises on the invoice.",
    scripture: "Hebrews 13:18",
  },
  {
    title: "Treat people and their property with respect",
    body: "Their home, their time, and each other — handled with care.",
    scripture: "Philippians 2:3, 4",
  },
  {
    title: "Skilled and dependable",
    body: "On time, done right. Our work reflects on the name we carry.",
    scripture: "Proverbs 22:29",
  },
]

// What's expected on the job — the practical standards behind the values.
export const EXPECTATIONS: string[] = [
  "Show up on time, in a Dr. Squeegee shirt, ready to work.",
  "Represent the name well — courteous, clean, professional at every door.",
  "Care for the truck, equipment, and supplies like they're your own.",
  "Communicate: running late, an issue on site, a customer question — say something.",
  "Work safely. No shortcut is worth an injury or property damage.",
  "Before you leave, walk the job: is it truly better than we found it?",
  "Take before/after photos on every job.",
]

// Setup checklist. `auto: true` items are derived from account state (account
// created, agreement signed). The rest are manual — the crew member (or Anthony)
// checks them off. SSN/W-4/I-9/direct deposit are all inside the Gusto step.
export interface OnboardingTask {
  key: string
  label: string
  detail?: string
  auto?: boolean
}

export const ONBOARDING_TASKS: OnboardingTask[] = [
  { key: "account", label: "Create your crew account", auto: true },
  { key: "agreement", label: "Read and agree to our values & terms", auto: true },
  {
    key: "gusto",
    label: "Complete your Gusto onboarding",
    detail: "W-4, I-9, and direct deposit — Gusto emails you the link. Do this so you get paid.",
  },
  { key: "uniform", label: "Get your Dr. Squeegee shirt", detail: "Anthony sets you up." },
  { key: "training", label: "First-job ride-along", detail: "Learn the routine on a real job before running solo." },
]
