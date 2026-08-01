"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Phone,
  MessageSquare,
  Sparkles,
  Check,
  StickyNote,
  MapPin,
  Clock,
} from "lucide-react"
import { SERVICE_TYPES } from "@/lib/squeegee/types"
import {
  FollowupCustomer,
  buildMessage,
  serviceFlag,
  firstName,
  formatPhone,
  telUrl,
  smsUrl,
  relativeDayLabel,
  shortDate,
  daysSince,
} from "@/lib/squeegee/followups"

type FilterKey = "all" | "needs" | "customers" | "cold" | "contacted"
type SortKey = "recent" | "value" | "oldest_contact" | "name"

function money(n: number) {
  return n > 0 ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"
}

export function FollowupsBoard({ customers }: { customers: FollowupCustomer[] }) {
  const [list, setList] = useState<FollowupCustomer[]>(customers)
  const [service, setService] = useState<string>("Window Cleaning")
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FilterKey>("all")
  const [sort, setSort] = useState<SortKey>("recent")
  const [noteFor, setNoteFor] = useState<FollowupCustomer | null>(null)
  const [noteText, setNoteText] = useState("")

  function applyLocal(phone10: string, patch: Partial<FollowupCustomer>) {
    setList((prev) => prev.map((c) => (c.phone10 === phone10 ? { ...c, ...patch } : c)))
  }

  async function log(
    c: FollowupCustomer,
    channel: "sms" | "call" | "note",
    serviceOffered: string | null,
    note?: string,
  ) {
    const nowIso = new Date().toISOString()
    applyLocal(c.phone10, {
      lastContactedAt: nowIso,
      lastContactChannel: channel,
      servicesOffered:
        serviceOffered && !c.servicesOffered.includes(serviceOffered)
          ? [...c.servicesOffered, serviceOffered]
          : c.servicesOffered,
    })
    try {
      await fetch("/api/crm/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          phone10: c.phone10,
          client_name: c.name,
          channel,
          service_offered: serviceOffered,
          note: note ?? null,
        }),
      })
    } catch {
      // optimistic update already applied; outreach log is non-critical
    }
  }

  function textOffer(c: FollowupCustomer) {
    log(c, "sms", service)
    window.location.href = smsUrl(c.phone10, buildMessage(service, c))
  }

  function callCustomer(c: FollowupCustomer) {
    log(c, "call", null)
    window.location.href = telUrl(c.phone10)
  }

  function saveNote() {
    if (!noteFor) return
    log(noteFor, "note", null, noteText.trim() || undefined)
    setNoteFor(null)
    setNoteText("")
  }

  const counts = useMemo(() => {
    let needs = 0
    for (const c of list) if (serviceFlag(c, service) === "needs") needs++
    return { needs, total: list.length }
  }, [list, service])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = list.filter((c) => {
      const flag = serviceFlag(c, service)
      if (filter === "needs" && flag !== "needs") return false
      if (filter === "customers" && c.jobCount === 0) return false
      if (filter === "contacted" && !c.lastContactedAt) return false
      if (filter === "cold") {
        const d = daysSince(c.lastContactedAt)
        if (d !== null && d < 60) return false
      }
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone10.includes(q.replace(/[^0-9]/g, "")) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.address ?? "").toLowerCase().includes(q) ||
        c.servicesHad.some((s) => s.toLowerCase().includes(q))
      )
    })
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "value":
          return b.lifetimeValue - a.lifetimeValue
        case "name":
          return a.name.localeCompare(b.name)
        case "oldest_contact": {
          // never-contacted first, then oldest contact
          const av = a.lastContactedAt ? Date.parse(a.lastContactedAt) : 0
          const bv = b.lastContactedAt ? Date.parse(b.lastContactedAt) : 0
          return av - bv
        }
        default: {
          // recent service first
          const av = a.lastServiceDate ? Date.parse(a.lastServiceDate) : 0
          const bv = b.lastServiceDate ? Date.parse(b.lastServiceDate) : 0
          return bv - av
        }
      }
    })
    return out
  }, [list, query, filter, sort, service])

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "needs", label: `Needs ${service}` },
    { key: "customers", label: "Past customers" },
    { key: "cold", label: "Cold 60d+" },
    { key: "contacted", label: "Contacted" },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Follow-Ups</h1>
          <p className="text-sm text-muted-foreground">
            {counts.needs} of {counts.total} haven&apos;t been offered {service.toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Pitching</span>
          <Select value={service} onValueChange={setService}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, address, service…"
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent service</SelectItem>
            <SelectItem value="value">Highest value</SelectItem>
            <SelectItem value="oldest_contact">Oldest contact</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-[var(--crm-accent)] text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} shown
        </span>
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No customers match — try a different search or filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const flag = serviceFlag(c, service)
            const lastContacted = c.lastContactedAt
            return (
              <Card key={c.phone10} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  {/* Top: name + value */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight truncate">{c.name}</p>
                      <button
                        onClick={() => callCustomer(c)}
                        className="text-sm text-[var(--crm-accent)] dark:text-[#7FB08F] hover:underline font-medium"
                      >
                        {formatPhone(c.phone10)}
                      </button>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{money(c.lifetimeValue)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.jobCount} job{c.jobCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  {/* Address */}
                  {c.address && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span className="truncate">{c.address}</span>
                    </p>
                  )}

                  {/* Flag + services had */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {flag === "needs" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8F0EA] text-[#1E3E2B] dark:bg-[#1A2E21] dark:text-[#A8C4B0]">
                        <Sparkles className="h-3 w-3" /> New: {service}
                      </span>
                    )}
                    {flag === "offered" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--crm-attention-bg)] text-[var(--crm-attention)] dark:bg-[var(--crm-attention-bg)] dark:text-[var(--crm-attention)]">
                        <Check className="h-3 w-3" /> Offered {service}
                      </span>
                    )}
                    {flag === "had" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
                        Had {service}
                      </span>
                    )}
                    {c.servicesHad
                      .filter((s) => s !== service)
                      .slice(0, 4)
                      .map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                  </div>

                  {/* Timeline */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last service: {shortDate(c.lastServiceDate)}
                      {c.lastServiceDate && ` · ${relativeDayLabel(c.lastServiceDate)}`}
                    </span>
                    <span>
                      Last contact:{" "}
                      {lastContacted ? (
                        <span className="text-foreground">
                          {relativeDayLabel(lastContacted)}
                          {c.lastContactChannel ? ` (${c.lastContactChannel})` : ""}
                        </span>
                      ) : (
                        <span className="text-[var(--crm-attention)] dark:text-[var(--crm-attention)]">never</span>
                      )}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      onClick={() => textOffer(c)}
                      size="sm"
                      className="bg-[var(--crm-accent)] hover:bg-[#2F5A3F] text-white"
                    >
                      <MessageSquare className="h-4 w-4 mr-1.5" />
                      Text {service.toLowerCase()} offer
                    </Button>
                    <Button onClick={() => callCustomer(c)} size="sm" variant="outline">
                      <Phone className="h-4 w-4 mr-1.5" />
                      Call
                    </Button>
                    <Button asChild size="sm" variant="outline" className="border-[var(--crm-accent-line)] text-[var(--crm-accent)] hover:bg-[var(--crm-accent-weak)]">
                      <Link href={`/crm/pitch?phone=${c.phone10}`}>
                        <Sparkles className="h-4 w-4 mr-1.5" />
                        Pitch Club
                      </Link>
                    </Button>
                    <Button
                      onClick={() => {
                        setNoteFor(c)
                        setNoteText("")
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      <StickyNote className="h-4 w-4 mr-1.5" />
                      Log
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Log / mark-contacted dialog */}
      <Dialog open={!!noteFor} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Log contact{noteFor ? ` — ${firstName(noteFor.name)}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Mark that you reached out (records today&apos;s date). Add an optional note —
              what they said, when to follow up next, etc.
            </p>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Left voicemail. Said call back in spring."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteFor(null)}>
              Cancel
            </Button>
            <Button onClick={saveNote} className="bg-[var(--crm-accent)] hover:bg-[#2F5A3F] text-white">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
