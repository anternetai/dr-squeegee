import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard, Gauge, Briefcase, Users, CalendarDays, HardHat,
  MessageSquareHeart, FileText, CalendarRange, Sparkles, Receipt,
  MapPin, DoorOpen,
} from "lucide-react"

/* ---------------------------------------------------------------------------
   Module registry
   ---------------------------------------------------------------------------
   The CRM is assembled from three modules that ship as separate repos:

     crm      — anternetai/dr-squeegee   (this repo; the system of record)
     quoting  — anternetai/dr-squeegee   (folded in; extractable)
     doors    — anternetai/doors         (private, paid unlock)

   A module declares what it PROVIDES and what it WANTS. Nothing imports across
   a module boundary directly — a feature that needs another module asks
   `has()` first and simply doesn't render if the answer is no. That is what
   makes the repos "expect each other": drop Doors in and the field nav plus
   the knock→quote handoff light up on their own; take it out and the CRM keeps
   working with no dangling imports and no dead routes.

   Installation is env-driven so adding a module is a deploy, not a refactor:
     NEXT_PUBLIC_CRM_MODULES="crm,quoting,doors"   (unset = everything on)
--------------------------------------------------------------------------- */

export type ModuleId = "crm" | "quoting" | "doors"

/** Cross-module contract. A capability is a promise one module makes to the
 *  others; it is the ONLY thing they are allowed to couple on. */
export type Capability =
  // crm
  | "client.record"
  | "job.schedule"
  | "crew.assign"
  // quoting
  | "quote.create"
  | "quote.send"
  | "plan.create"
  // doors
  | "field.territory"
  | "field.knock"

export interface NavEntry {
  label: string
  href: string
  icon: LucideIcon
  /** Shown in the rail's flyout, not on the rail itself. */
  hint?: string
}

export interface ModuleManifest {
  id: ModuleId
  label: string
  /** One line, shown in Settings → Modules. */
  blurb: string
  repo: string
  /** Quiet section heading above this module's nav entries. */
  navGroup: string
  nav: NavEntry[]
  provides: Capability[]
  /** Optional. Features gated on these degrade silently when absent. */
  wants: Capability[]
  /** Supabase tables this module owns. Documented so an extraction knows
   *  exactly what travels with it. */
  tables: string[]
}

const CRM: ModuleManifest = {
  id: "crm",
  label: "CRM",
  blurb: "Clients, jobs, scheduling, crew. The system of record.",
  repo: "anternetai/dr-squeegee",
  navGroup: "Operations",
  nav: [
    { label: "Jobs", href: "/crm/jobs", icon: Briefcase, hint: "Everything in flight" },
    { label: "Clients", href: "/crm/clients", icon: Users },
    { label: "Calendar", href: "/crm/calendar", icon: CalendarDays },
    { label: "Follow-Ups", href: "/crm/followups", icon: MessageSquareHeart },
    { label: "Crew", href: "/crm/team", icon: HardHat },
  ],
  provides: ["client.record", "job.schedule", "crew.assign"],
  wants: ["quote.create", "field.knock"],
  tables: [
    "squeegee_clients", "squeegee_jobs", "squeegee_activity",
    "squeegee_members", "crew_sessions",
  ],
}

const QUOTING: ModuleManifest = {
  id: "quoting",
  label: "Quoting",
  blurb: "Quotes, care plans, the pitch tool and invoices.",
  repo: "anternetai/dr-squeegee",
  navGroup: "Sales",
  nav: [
    { label: "New Quote", href: "/crm/quotes/new", icon: FileText, hint: "Price a job" },
    { label: "Plans", href: "/crm/plans", icon: CalendarRange },
    { label: "Pitch", href: "/crm/pitch", icon: Sparkles },
    { label: "Invoices", href: "/crm/invoices", icon: Receipt },
  ],
  provides: ["quote.create", "quote.send", "plan.create"],
  wants: ["client.record"],
  tables: [
    "squeegee_quotes", "squeegee_invoices", "squeegee_plans", "squeegee_plan_visits",
  ],
}

const DOORS: ModuleManifest = {
  id: "doors",
  label: "Doors",
  blurb: "Territory map, door knocking, session tracking and commission.",
  repo: "anternetai/doors",
  navGroup: "Field",
  nav: [
    { label: "Field", href: "/crm/field", icon: MapPin, hint: "Territory map" },
    { label: "Knocks", href: "/crm/field/knocks", icon: DoorOpen, hint: "Today's doors" },
  ],
  provides: ["field.territory", "field.knock"],
  wants: ["client.record", "quote.create"],
  tables: ["territories", "doors_territory_doors"],
}

/** Every module that exists, installed or not. */
export const ALL_MODULES: ModuleManifest[] = [CRM, QUOTING, DOORS]

/** Nav that belongs to the shell itself and survives any module being removed. */
export const CORE_NAV: NavEntry[] = [
  { label: "Dashboard", href: "/crm", icon: LayoutDashboard },
  { label: "Command", href: "/crm/ops", icon: Gauge, hint: "Today at a glance" },
]

function installedIds(): ModuleId[] {
  const raw = process.env.NEXT_PUBLIC_CRM_MODULES?.trim()
  if (!raw) return ALL_MODULES.map((m) => m.id)
  const wanted = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))
  return ALL_MODULES.filter((m) => wanted.has(m.id)).map((m) => m.id)
}

const INSTALLED_IDS = new Set<ModuleId>(installedIds())

export const INSTALLED_MODULES: ModuleManifest[] = ALL_MODULES.filter((m) =>
  INSTALLED_IDS.has(m.id)
)

const AVAILABLE = new Set<Capability>(
  INSTALLED_MODULES.flatMap((m) => m.provides)
)

/** Gate cross-module features on this. Never import across a module boundary
 *  without it — that is the thing that makes a module non-removable. */
export function has(cap: Capability): boolean {
  return AVAILABLE.has(cap)
}

export function isInstalled(id: ModuleId): boolean {
  return INSTALLED_IDS.has(id)
}

/** Nav grouped for the shell: core first, then one quiet section per module. */
export function navGroups(): { heading: string | null; items: NavEntry[] }[] {
  return [
    { heading: null, items: CORE_NAV },
    ...INSTALLED_MODULES.map((m) => ({ heading: m.navGroup, items: m.nav })),
  ]
}

export function allNavEntries(): NavEntry[] {
  return navGroups().flatMap((g) => g.items)
}

/** Longest-prefix match so /crm/field/knocks resolves to Knocks, not Territories,
 *  and /crm only ever matches Dashboard exactly. */
export function activeEntry(pathname: string): NavEntry | null {
  let best: NavEntry | null = null
  for (const e of allNavEntries()) {
    const hit = e.href === "/crm" ? pathname === "/crm" : pathname.startsWith(e.href)
    if (hit && (!best || e.href.length > best.href.length)) best = e
  }
  return best
}
