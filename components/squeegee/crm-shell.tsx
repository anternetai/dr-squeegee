"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  LayoutDashboard, Briefcase, Users, CalendarDays, CalendarRange, MapPin,
  MessageSquareHeart, Sun, Moon, LogOut, Menu, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { label: "Dashboard",  href: "/crm",             icon: LayoutDashboard },
  { label: "Jobs",       href: "/crm/jobs",         icon: Briefcase },
  { label: "Clients",    href: "/crm/clients",      icon: Users },
  { label: "Plans",      href: "/crm/plans",        icon: CalendarRange },
  { label: "Follow-Ups", href: "/crm/followups",    icon: MessageSquareHeart },
  { label: "Calendar",   href: "/crm/calendar",     icon: CalendarDays },
  { label: "Territories",href: "/crm/territories",  icon: MapPin },
]

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen]       = useState(false)

  useEffect(() => {
    setMounted(true)
    setOpen(window.innerWidth >= 768)
  }, [])

  // Auto-close on mobile when navigating
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) setOpen(false)
  }, [pathname])

  async function logout() {
    await fetch("/api/crm/auth/logout", { method: "POST" })
    router.push("/crm/login")
    router.refresh()
  }

  const activeLabel = NAV.find(n =>
    n.href === "/crm" ? pathname === "/crm" : pathname.startsWith(n.href)
  )?.label ?? "CRM"

  return (
    <div className="min-h-screen bg-background flex">

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full z-50 flex flex-col w-56 bg-card border-r border-border transition-transform duration-200 ease-in-out",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo row */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
          <Link href="/crm" onClick={() => window.innerWidth < 768 && setOpen(false)}>
            <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-10 w-auto" />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ label, href, icon: Icon }) => {
            const active = href === "/crm" ? pathname === "/crm" : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => window.innerWidth < 768 && setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-[#2D8C6F]/10 text-[#2D8C6F] dark:bg-[#2D8C6F]/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 py-3 border-t border-border space-y-0.5 shrink-0">
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* Content area — shifts right on desktop when sidebar open */}
      <div className={cn(
        "flex flex-col flex-1 min-w-0 transition-[margin] duration-200 ease-in-out",
        open ? "md:ml-56" : "md:ml-0"
      )}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-12 bg-background/90 backdrop-blur border-b border-border flex items-center px-4 gap-3 shrink-0">
          <button
            onClick={() => setOpen(!open)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">{activeLabel}</span>
        </header>

        {/* Page */}
        <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
