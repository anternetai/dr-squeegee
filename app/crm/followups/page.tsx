import { createClient } from "@/lib/supabase/server"
import { FollowupsBoard } from "@/components/squeegee/followups-board"
import { FollowupCustomer, PLACEHOLDER_PHONES } from "@/lib/squeegee/followups"

export const dynamic = "force-dynamic"

function phone10Of(raw: string | null | undefined): string | null {
  const digits = (raw || "").replace(/[^0-9]/g, "")
  if (digits.length < 10) return null
  return digits.slice(-10)
}

function splitServices(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .map((s) => (typeof s === "string" ? s : (s?.name ?? s?.service ?? "")))
      .filter(Boolean)
      .map(String)
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

// Working accumulator while merging the four source tables by phone.
interface Acc {
  phone10: string
  name: string
  email: string | null
  address: string | null
  services: Set<string>
  lastServiceType: string | null
  lastServiceAt: number // epoch ms, 0 if none
  jobCount: number
  quoteCount: number
  lifetimeValue: number
  firstSeen: number
  sources: Set<string>
}

export default async function FollowupsPage() {
  const supabase = await createClient()

  const [clientsRes, jobsRes, quotesRes, leadsRes, outreachRes] = await Promise.all([
    supabase.from("squeegee_clients").select("name, phone, email, address, created_at, blacklisted"),
    supabase
      .from("squeegee_jobs")
      .select("client_name, client_phone, client_email, address, service_type, price, appointment_date, created_at"),
    supabase
      .from("squeegee_quotes")
      .select("client_name, client_phone, client_email, address, services, total_price, created_at"),
    supabase.from("squeegee_leads").select("name, phone, email, address, services, created_at"),
    supabase.from("squeegee_outreach").select("phone10, channel, service_offered, created_at"),
  ])

  const acc = new Map<string, Acc>()
  const blacklisted = new Set<string>()

  function touch(phone10: string, name: string | null, email: string | null, address: string | null, createdAt: string | null, source: string): Acc {
    let a = acc.get(phone10)
    if (!a) {
      a = {
        phone10,
        name: "",
        email: null,
        address: null,
        services: new Set(),
        lastServiceType: null,
        lastServiceAt: 0,
        jobCount: 0,
        quoteCount: 0,
        lifetimeValue: 0,
        firstSeen: Number.MAX_SAFE_INTEGER,
        sources: new Set(),
      }
      acc.set(phone10, a)
    }
    if (name && name.trim() && !a.name) a.name = name.trim()
    if (email && email.trim() && !a.email) a.email = email.trim()
    if (address && address.trim() && !a.address) a.address = address.trim()
    if (createdAt) {
      const t = Date.parse(createdAt)
      if (!Number.isNaN(t) && t < a.firstSeen) a.firstSeen = t
    }
    a.sources.add(source)
    return a
  }

  // Clients (canonical contact info + blacklist)
  for (const c of clientsRes.data ?? []) {
    const p = phone10Of(c.phone as string)
    if (!p) continue
    touch(p, c.name as string, c.email as string, c.address as string, c.created_at as string, "client")
    if (c.blacklisted) blacklisted.add(p)
  }

  // Jobs — actual services performed + revenue
  for (const j of jobsRes.data ?? []) {
    const p = phone10Of(j.client_phone as string)
    if (!p) continue
    const a = touch(p, j.client_name as string, j.client_email as string, j.address as string, j.created_at as string, "job")
    a.jobCount += 1
    a.lifetimeValue += Number(j.price) || 0
    const svcs = splitServices(j.service_type)
    svcs.forEach((s) => a.services.add(s))
    const when = Date.parse((j.appointment_date as string) || (j.created_at as string) || "")
    if (!Number.isNaN(when) && when >= a.lastServiceAt) {
      a.lastServiceAt = when
      a.lastServiceType = svcs[0] || a.lastServiceType
    }
  }

  // Quotes — interest signal
  for (const q of quotesRes.data ?? []) {
    const p = phone10Of(q.client_phone as string)
    if (!p) continue
    const a = touch(p, q.client_name as string, q.client_email as string, q.address as string, q.created_at as string, "quote")
    a.quoteCount += 1
    splitServices(q.services).forEach((s) => a.services.add(s))
  }

  // Leads — interest signal
  for (const l of leadsRes.data ?? []) {
    const p = phone10Of(l.phone as string)
    if (!p) continue
    const a = touch(p, l.name as string, l.email as string, l.address as string, l.created_at as string, "lead")
    splitServices(l.services).forEach((s) => a.services.add(s))
  }

  // Outreach log → last contacted + services already pitched
  const outreach = new Map<string, { lastAt: number; channel: string | null; offered: Set<string> }>()
  for (const o of outreachRes.data ?? []) {
    const p = String(o.phone10 || "")
    if (!p) continue
    let r = outreach.get(p)
    if (!r) {
      r = { lastAt: 0, channel: null, offered: new Set() }
      outreach.set(p, r)
    }
    const t = Date.parse(o.created_at as string)
    if (!Number.isNaN(t) && t >= r.lastAt) {
      r.lastAt = t
      r.channel = (o.channel as string) || r.channel
    }
    if (o.service_offered) r.offered.add(String(o.service_offered))
  }

  const customers: FollowupCustomer[] = []
  for (const a of acc.values()) {
    if (!a.name || PLACEHOLDER_PHONES.has(a.phone10)) continue
    if (blacklisted.has(a.phone10)) continue
    const o = outreach.get(a.phone10)
    customers.push({
      phone10: a.phone10,
      name: a.name,
      email: a.email,
      address: a.address,
      servicesHad: [...a.services].sort(),
      lastServiceType: a.lastServiceType,
      jobCount: a.jobCount,
      quoteCount: a.quoteCount,
      lifetimeValue: a.lifetimeValue,
      lastServiceDate: a.lastServiceAt > 0 ? new Date(a.lastServiceAt).toISOString() : null,
      firstSeen: a.firstSeen < Number.MAX_SAFE_INTEGER ? new Date(a.firstSeen).toISOString() : null,
      sources: [...a.sources],
      lastContactedAt: o && o.lastAt > 0 ? new Date(o.lastAt).toISOString() : null,
      lastContactChannel: o?.channel ?? null,
      servicesOffered: o ? [...o.offered] : [],
    })
  }

  return <FollowupsBoard customers={customers} />
}
