"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, Briefcase, Clock } from "lucide-react"

/**
 * The crew app's bottom bar. Three labelled tabs — labels, not just icons,
 * because the person tapping this is in direct sun with wet hands and has
 * never seen a tutorial.
 *
 * It stays off the login / join screens (no session) and off the job screen,
 * whose bottom edge already belongs to the one big action button.
 */
const TABS = [
  { href: "/team", label: "Jobs", icon: Briefcase },
  { href: "/team/me", label: "My week", icon: Clock },
  { href: "/team/standards", label: "Standards", icon: BookOpen },
] as const

export function showTeamNav(pathname: string): boolean {
  if (pathname.startsWith("/team/login")) return false
  if (pathname.startsWith("/team/join")) return false
  if (pathname.startsWith("/team/jobs/")) return false
  return pathname === "/team" || pathname.startsWith("/team/")
}

export function TeamNav() {
  const pathname = usePathname()
  if (!showTeamNav(pathname)) return null

  return (
    <>
      {/* Spacer so the last card scrolls clear of the bar. */}
      <div aria-hidden className="h-24" />
      <nav
        aria-label="Crew"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1F1F1F] bg-[#0A0A0A]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-lg grid-cols-3">
          {TABS.map((t) => {
            const active = t.href === "/team" ? pathname === "/team" : pathname.startsWith(t.href)
            const Icon = t.icon
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-semibold ${
                  active ? "text-[#4FC49E]" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full ${
                    active ? "bg-[#2D8C6F]/20" : ""
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                {t.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
