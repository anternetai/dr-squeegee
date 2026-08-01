"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Search, LogOut, MoreHorizontal, Command as CommandIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { navGroups, activeEntry, isInstalled, type NavEntry } from "@/lib/crm/modules"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"

/* The four destinations that earn a thumb on the bottom bar. Anything else
   lives behind More — the field phone is one-handed, not a nav directory. */
function mobilePrimary(): NavEntry[] {
  const groups = navGroups()
  const flat = groups.flatMap((g) => g.items)
  const wanted = [
    "/crm",
    "/crm/jobs",
    isInstalled("doors") ? "/crm/field" : null,
    isInstalled("quoting") ? "/crm/quotes/new" : null,
  ].filter(Boolean) as string[]
  return wanted
    .map((href) => flat.find((e) => e.href === href))
    .filter(Boolean) as NavEntry[]
}

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  // Radix's Dialog derives ids from useId; server and client disagree on the
  // palette's sr-only title, so it is mounted only after hydration.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const groups = useMemo(() => navGroups(), [])
  const primary = useMemo(() => mobilePrimary(), [])
  const active = activeEntry(pathname)

  // ⌘K / Ctrl-K anywhere. With eleven destinations behind icons, the palette
  // is the real navigation — the rail is just the muscle-memory shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  async function logout() {
    await fetch("/api/crm/auth/logout", { method: "POST" })
    router.push("/crm/login")
    router.refresh()
  }

  function go(href: string) {
    setPaletteOpen(false)
    setMoreOpen(false)
    router.push(href)
  }

  return (
    // data-crm activates the CRM token scope; `dark` keeps every existing
    // `dark:` utility in the page tree resolving against a dark ground.
    <div data-crm className="dark min-h-screen bg-background text-foreground">
      <TooltipProvider delayDuration={100}>

        {/* ---------------- Desktop rail ---------------- */}
        <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-16 flex-col items-center border-r border-[var(--crm-line)] bg-[var(--sidebar)]">
          <Link href="/crm" className="flex h-16 w-16 items-center justify-center shrink-0">
            <Image
              src="/images/squeegee/logo-badge.png"
              alt="Dr. Squeegee"
              width={36}
              height={36}
              className="h-9 w-auto"
            />
          </Link>

          <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
            {groups.map((group, gi) => (
              <div key={group.heading ?? "core"} className="flex flex-col items-center gap-1">
                {gi > 0 && <div className="my-2 h-px w-6 bg-[var(--crm-line)]" />}
                {group.items.map((entry) => {
                  const on = active?.href === entry.href
                  const Icon = entry.icon
                  return (
                    <Tooltip key={entry.href}>
                      <TooltipTrigger asChild>
                        <Link
                          href={entry.href}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                            on
                              ? "bg-[var(--crm-accent-weak)] text-[var(--crm-accent)]"
                              : "text-[var(--crm-text-faint)] hover:bg-[var(--crm-surface-high)] hover:text-[var(--crm-text)]"
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                          {on && (
                            <span className="absolute -left-2 h-5 w-0.5 rounded-full bg-[var(--crm-accent)]" />
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="flex items-center gap-2">
                        <span>{entry.label}</span>
                        {entry.hint && (
                          <span className="text-[var(--crm-text-faint)]">{entry.hint}</span>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </nav>

          <div className="shrink-0 pb-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={logout}
                  aria-label="Log out"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--crm-text-faint)] transition-colors hover:bg-[var(--crm-surface-high)] hover:text-[var(--crm-text)]"
                >
                  <LogOut className="h-[18px] w-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Log out</TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* ---------------- Content column ---------------- */}
        <div className="flex min-h-screen flex-col md:pl-16">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--crm-line)] bg-[color-mix(in_srgb,var(--crm-ground)_88%,transparent)] px-4 backdrop-blur">
            <Image
              src="/images/squeegee/logo-badge.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-auto md:hidden"
            />
            <h1 className="text-sm font-semibold tracking-tight">
              {active?.label ?? "CRM"}
            </h1>

            <button
              onClick={() => setPaletteOpen(true)}
              className="ml-auto flex items-center gap-2 rounded-lg border border-[var(--crm-line)] bg-[var(--crm-surface)] py-1.5 pl-2.5 pr-2 text-sm text-[var(--crm-text-faint)] transition-colors hover:border-[var(--crm-accent-line)] hover:text-[var(--crm-text-dim)]"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Find anything</span>
              <kbd className="hidden items-center gap-0.5 rounded border border-[var(--crm-line)] px-1.5 py-0.5 text-[10px] sm:flex">
                <CommandIcon className="h-2.5 w-2.5" />K
              </kbd>
            </button>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 md:px-6 md:pb-8">
            {children}
          </main>
        </div>

        {/* ---------------- Mobile bottom bar ---------------- */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-[var(--crm-line)] bg-[var(--crm-surface)] md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {primary.map((entry) => {
            const on = active?.href === entry.href
            const Icon = entry.icon
            return (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  on ? "text-[var(--crm-accent)]" : "text-[var(--crm-text-faint)]"
                )}
              >
                <Icon className="h-5 w-5" />
                {entry.label}
              </Link>
            )
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-[var(--crm-text-faint)]"
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </nav>

        {/* ---------------- Command palette (⌘K, and More on mobile) ------- */}
        {mounted && (
        <CommandDialog
          open={paletteOpen || moreOpen}
          onOpenChange={(v) => {
            if (!v) { setPaletteOpen(false); setMoreOpen(false) }
          }}
        >
          <CommandInput placeholder="Jump to a page, or search…" />
          <CommandList>
            <CommandEmpty>Nothing matches that.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.heading ?? "core"} heading={group.heading ?? "Go to"}>
                {group.items.map((entry) => {
                  const Icon = entry.icon
                  return (
                    <CommandItem
                      key={entry.href}
                      value={`${entry.label} ${entry.hint ?? ""}`}
                      onSelect={() => go(entry.href)}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span>{entry.label}</span>
                      {entry.hint && (
                        <span className="ml-auto text-xs text-[var(--crm-text-faint)]">
                          {entry.hint}
                        </span>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
            <CommandGroup heading="Session">
              <CommandItem value="log out sign out" onSelect={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
        )}
      </TooltipProvider>
    </div>
  )
}
