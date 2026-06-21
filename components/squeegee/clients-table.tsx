"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, Phone, Mail, ShieldBan, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

export interface EnrichedClient {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  blacklisted: boolean
  job_count: number
  total_value: number
  last_job: string | null
}

type FilterKey = "all" | "with_jobs" | "no_jobs" | "blacklisted"
type SortKey = "name" | "jobs" | "value" | "recent"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "with_jobs", label: "With jobs" },
  { key: "no_jobs", label: "No jobs" },
  { key: "blacklisted", label: "Blacklisted" },
]

function money(n: number) {
  return n > 0 ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"
}
function shortDate(s: string | null) {
  if (!s) return "—"
  const d = new Date(s)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })
}

export function ClientsTable({ clients }: { clients: EnrichedClient[] }) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FilterKey>("all")
  const [sort, setSort] = useState<SortKey>("name")
  const [dir, setDir] = useState<"asc" | "desc">("asc")

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSort(key)
      setDir(key === "name" ? "asc" : "desc")
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = clients.filter((c) => {
      if (filter === "with_jobs" && c.job_count === 0) return false
      if (filter === "no_jobs" && c.job_count > 0) return false
      if (filter === "blacklisted" && !c.blacklisted) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.address ?? "").toLowerCase().includes(q)
      )
    })
    const mult = dir === "asc" ? 1 : -1
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "jobs": return (a.job_count - b.job_count) * mult
        case "value": return (a.total_value - b.total_value) * mult
        case "recent": return ((a.last_job ? Date.parse(a.last_job) : 0) - (b.last_job ? Date.parse(b.last_job) : 0)) * mult
        default: return a.name.localeCompare(b.name) * mult
      }
    })
    return list
  }, [clients, query, filter, sort, dir])

  function SortIcon({ k }: { k: SortKey }) {
    if (sort !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, email, or address…"
          className="pl-9"
        />
      </div>

      {/* Filters + count */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === f.key
                ? "bg-[#3A6B4C] text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} of {clients.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No clients match — try a different search or filter.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">
                        <button onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 hover:text-foreground">Name <SortIcon k="name" /></button>
                      </th>
                      <th className="text-left px-4 py-3 font-medium">Phone</th>
                      <th className="text-left px-4 py-3 font-medium">Email</th>
                      <th className="text-left px-4 py-3 font-medium">Address</th>
                      <th className="text-right px-4 py-3 font-medium">
                        <button onClick={() => toggleSort("jobs")} className="inline-flex items-center gap-1 hover:text-foreground">Jobs <SortIcon k="jobs" /></button>
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        <button onClick={() => toggleSort("value")} className="inline-flex items-center gap-1 hover:text-foreground">Value <SortIcon k="value" /></button>
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        <button onClick={() => toggleSort("recent")} className="inline-flex items-center gap-1 hover:text-foreground">Last job <SortIcon k="recent" /></button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/crm/clients/${c.id}`} className="flex items-center gap-2 font-medium hover:text-[#3A6B4C]">
                            {c.blacklisted && <ShieldBan className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                            <span className={c.blacklisted ? "text-red-600 dark:text-red-400" : ""}>{c.name}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground"><Link href={`/crm/clients/${c.id}`} className="block">{c.phone || "—"}</Link></td>
                        <td className="px-4 py-3 text-muted-foreground"><Link href={`/crm/clients/${c.id}`} className="block truncate max-w-[180px]">{c.email || "—"}</Link></td>
                        <td className="px-4 py-3 text-muted-foreground"><Link href={`/crm/clients/${c.id}`} className="block truncate max-w-[200px]">{c.address || "—"}</Link></td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold bg-[#E8F0EA] text-[#1E3E2B] dark:bg-[#1A2E21] dark:text-[#A8C4B0]">{c.job_count}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{money(c.total_value)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">{shortDate(c.last_job)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((c) => (
              <Link key={c.id} href={`/crm/clients/${c.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {c.blacklisted && <ShieldBan className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        <p className={`font-semibold ${c.blacklisted ? "text-red-600 dark:text-red-400" : ""}`}>{c.name}</p>
                      </div>
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold bg-[#E8F0EA] text-[#1E3E2B] dark:bg-[#1A2E21] dark:text-[#A8C4B0]">
                        {c.job_count} job{c.job_count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" />{c.phone}</span>}
                      {c.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{c.email}</span></span>}
                      {c.address && <span className="truncate text-xs">{c.address}</span>}
                    </div>
                    <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border mt-1">
                      <span>{money(c.total_value)} lifetime</span>
                      <span>Last: {shortDate(c.last_job)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
