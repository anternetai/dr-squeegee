"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { LayoutDashboard, Briefcase, Users, CalendarDays, MapPin, Sun, Moon, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

const navItems = [
  { label: "Territories", href: "/crm/territories", icon: MapPin },
  { label: "Dashboard", href: "/crm", icon: LayoutDashboard },
  { label: "Jobs", href: "/crm/jobs", icon: Briefcase },
  { label: "Clients", href: "/crm/clients", icon: Users },
  { label: "Calendar", href: "/crm/calendar", icon: CalendarDays },
]

export function SqueegeeNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  async function handleLogout() {
    await fetch("/api/crm/auth/logout", { method: "POST" })
    router.push("/crm/login")
    router.refresh()
  }

  return (
    <header className="border-b border-border bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex h-14 items-center gap-4">
          {/* Brand */}
          <Link
            href="/crm"
            className="flex items-center gap-2 shrink-0"
          >
            <span
              className="font-bold text-[#3A6B4C]"
              style={{ fontFamily: "var(--font-brand-display), serif" }}
            >
              Dr. Squeegee
            </span>
          </Link>

          {/* Nav — scrollable on mobile */}
          <nav className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive =
                item.href === "/crm"
                  ? pathname === "/crm"
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0",
                    isActive
                      ? "bg-[#E8F0EA] text-[#1E3E2B] dark:bg-[#1A2E21] dark:text-[#A8C4B0]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right — theme toggle + logout */}
          <div className="flex items-center gap-1 shrink-0">
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
