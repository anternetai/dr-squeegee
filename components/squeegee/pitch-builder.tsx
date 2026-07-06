"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Search, Sparkles, Trash2 } from "lucide-react"
import {
  computePlanPricing,
  formatMoney,
  PLAN_SERVICE_CATALOG,
  type PlanBilling,
  type PlanService,
} from "@/lib/squeegee/plans"
import {
  CADENCES,
  catalogPriceOf,
  servicePriceHistory,
  suggestMemberRate,
  type Cadence,
  type HistoryJob,
} from "@/lib/squeegee/pitch"

interface ClientOption {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
}

interface Props {
  clients: ClientOption[]
  jobs: (HistoryJob & { client_phone: string | null })[]
  initialClientId: string | null
  initialPhone: string | null
}

function phone10Of(raw: string | null | undefined): string | null {
  const digits = (raw || "").replace(/[^0-9]/g, "")
  if (digits.length < 10) return null
  return digits.slice(-10)
}

const QUARTERLY = CADENCES.find((c) => c.visitsPerYear === 4)!

export function PitchBuilder({ clients, jobs, initialClientId, initialPhone }: Props) {
  const router = useRouter()

  const initialClient =
    (initialClientId && clients.find((c) => c.id === initialClientId)) ||
    (initialPhone && clients.find((c) => phone10Of(c.phone) === initialPhone)) ||
    null

  const [selected, setSelected] = useState<ClientOption | null>(initialClient)
  const [search, setSearch] = useState("")
  const [cadence, setCadence] = useState<Cadence>(QUARTERLY)
  const [anchorFamily, setAnchorFamily] = useState<string | null>(null)
  const [oneTimePrice, setOneTimePrice] = useState(0)
  const [memberRate, setMemberRate] = useState(0)
  const [addOns, setAddOns] = useState<PlanService[]>([])
  const [billing, setBilling] = useState<PlanBilling>("paid_in_full")
  const [pifDiscount, setPifDiscount] = useState(30)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Selected customer's job history
  const clientJobs = useMemo(() => {
    const p = phone10Of(selected?.phone)
    if (!p) return []
    return jobs.filter((j) => phone10Of(j.client_phone) === p)
  }, [selected, jobs])

  const history = useMemo(() => servicePriceHistory(clientJobs), [clientJobs])
  const lifetimeValue = clientJobs.reduce((s, j) => s + (Number(j.price) || 0), 0)
  const lastJob = clientJobs[0] ?? null

  // When a customer is picked, seed the anchor from their most recent priced service
  function pickClient(c: ClientOption) {
    setSelected(c)
    setSearch("")
    const theirJobs = jobs.filter((j) => phone10Of(j.client_phone) === phone10Of(c.phone))
    const theirHistory = servicePriceHistory(theirJobs)
    const first = theirHistory.values().next().value
    const family = first?.family ?? "Window Cleaning"
    const oneTime = first?.lastPrice ?? catalogPriceOf(family)
    setAnchorFamily(family)
    setOneTimePrice(oneTime)
    setMemberRate(suggestMemberRate(oneTime, QUARTERLY.suggestedDiscountPct))
    setCadence(QUARTERLY)
    setAddOns([])
    setInitialized(true)
  }

  // Deep-linked customer: seed once on first render
  if (initialClient && !initialized) {
    pickClient(initialClient)
  }

  function setAnchor(family: string) {
    setAnchorFamily(family)
    const oneTime = history.get(family)?.lastPrice ?? catalogPriceOf(family)
    setOneTimePrice(oneTime)
    setMemberRate(suggestMemberRate(oneTime, cadence.suggestedDiscountPct))
  }

  function pickCadence(c: Cadence) {
    setCadence(c)
    setMemberRate(suggestMemberRate(oneTimePrice, c.suggestedDiscountPct))
  }

  function changeOneTime(v: number) {
    setOneTimePrice(v)
    setMemberRate(suggestMemberRate(v, cadence.suggestedDiscountPct))
  }

  function toggleAddOn(name: string) {
    setAddOns((prev) => {
      if (prev.some((a) => a.name === name)) return prev.filter((a) => a.name !== name)
      const cat = PLAN_SERVICE_CATALOG.find((s) => s.name === name)
      return [
        ...prev,
        {
          name,
          description: cat?.description ?? "",
          visits_per_year: 1,
          price_per_visit: history.get(name)?.lastPrice ?? cat?.price_per_visit ?? 250,
        },
      ]
    })
  }

  function updateAddOn(name: string, patch: Partial<PlanService>) {
    setAddOns((prev) => prev.map((a) => (a.name === name ? { ...a, ...patch } : a)))
  }

  const services: PlanService[] = useMemo(() => {
    if (!anchorFamily || memberRate <= 0) return addOns
    const cat = PLAN_SERVICE_CATALOG.find((s) => s.name === anchorFamily)
    return [
      {
        name: anchorFamily,
        description: cat?.description ?? "",
        visits_per_year: cadence.visitsPerYear,
        price_per_visit: memberRate,
      },
      ...addOns.filter((a) => a.name !== anchorFamily),
    ]
  }, [anchorFamily, memberRate, cadence, addOns])

  const pricing = useMemo(() => computePlanPricing(services, pifDiscount), [services, pifDiscount])
  const perVisitSavings = oneTimePrice > 0 && memberRate > 0 ? oneTimePrice - memberRate : 0
  // Anthony's floor: what the anchor visit nets after the PIF discount stacks
  const effectiveFloor = memberRate > 0 ? memberRate * (1 - pifDiscount / 100) : 0

  const filteredClients = search.trim()
    ? clients.filter((c) =>
        `${c.name} ${c.phone ?? ""} ${c.address ?? ""}`.toLowerCase().includes(search.toLowerCase())
      )
    : []

  async function createPlan() {
    if (!selected || services.length === 0 || submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch("/api/squeegee/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selected.id,
          client_name: selected.name,
          client_phone: selected.phone ?? undefined,
          client_email: selected.email ?? undefined,
          address: selected.address ?? "Address on file",
          services,
          billing,
          discount_percent: pifDiscount,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to create plan")
        return
      }
      router.push(`/crm/plans/${json.plan.id}`)
    } catch {
      setErrorMsg("Network error — try again")
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    "w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-[#2D8C6F]"

  return (
    <div className="space-y-5 pb-56">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#2D8C6F]" />
          Care Club Pitch
        </h1>
        <p className="text-sm text-muted-foreground">
          Their history, their numbers, one tap to the agreement.
        </p>
      </div>

      {/* Customer */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {selected ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{selected.name}</p>
              <p className="text-xs text-muted-foreground truncate">{selected.address}</p>
              <p className="text-xs mt-1.5">
                <span className="text-[#2D8C6F] font-semibold tabular-nums">
                  {clientJobs.length} job{clientJobs.length !== 1 ? "s" : ""} · {formatMoney(lifetimeValue)} lifetime
                </span>
                {lastJob && (
                  <span className="text-muted-foreground">
                    {" "}· last: {lastJob.service_type ?? "service"} {Number(lastJob.price) > 0 ? formatMoney(Number(lastJob.price)) : ""}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => {
                setSelected(null)
                setAnchorFamily(null)
              }}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              Change
            </button>
          </div>
        ) : (
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer (name, phone, address)"
                className={`${inputCls} pl-9`}
                autoFocus
              />
            </div>
            {filteredClients.length > 0 && (
              <div className="mt-2 rounded-lg border border-border divide-y divide-border max-h-64 overflow-y-auto">
                {filteredClients.slice(0, 8).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => pickClient(c)}
                    className="w-full px-3 py-2.5 text-left hover:bg-muted transition-colors"
                  >
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.address ?? c.phone}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <>
          {/* Anchor service */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              The service they know
            </p>
            <div className="flex flex-wrap gap-2">
              {PLAN_SERVICE_CATALOG.map((s) => {
                const h = history.get(s.name)
                const active = anchorFamily === s.name
                return (
                  <button
                    key={s.name}
                    onClick={() => setAnchor(s.name)}
                    className={`text-xs font-medium rounded-full border px-3 py-1.5 transition-colors ${
                      active
                        ? "border-[#2D8C6F] bg-[#2D8C6F]/10 text-[#2D8C6F]"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {s.name}
                    {h && <span className="ml-1 opacity-70">({formatMoney(h.lastPrice)})</span>}
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground">
                  One-time price {history.get(anchorFamily ?? "") ? "(what they paid)" : ""}
                </label>
                <input
                  type="number"
                  min={0}
                  step={25}
                  value={oneTimePrice || ""}
                  onChange={(e) => changeOneTime(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[11px] text-[#2D8C6F]">
                  Member rate (−{cadence.suggestedDiscountPct}% suggested)
                </label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={memberRate || ""}
                  onChange={(e) => setMemberRate(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Cadence */}
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5">How often?</p>
              <div className="flex flex-wrap gap-2">
                {CADENCES.filter((c) => c.group === "residential").map((c) => (
                  <button
                    key={c.visitsPerYear}
                    onClick={() => pickCadence(c)}
                    className={`text-xs font-medium rounded-full border px-3 py-1.5 transition-colors ${
                      cadence.visitsPerYear === c.visitsPerYear
                        ? "border-[#2D8C6F] bg-[#2D8C6F]/10 text-[#2D8C6F]"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 mb-1.5">Storefront routes</p>
              <div className="flex flex-wrap gap-2">
                {CADENCES.filter((c) => c.group === "storefront").map((c) => (
                  <button
                    key={c.visitsPerYear}
                    onClick={() => pickCadence(c)}
                    className={`text-xs font-medium rounded-full border px-3 py-1.5 transition-colors ${
                      cadence.visitsPerYear === c.visitsPerYear
                        ? "border-[#2D8C6F] bg-[#2D8C6F]/10 text-[#2D8C6F]"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Add-ons */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Are they also adding…
            </p>
            <div className="flex flex-wrap gap-2">
              {PLAN_SERVICE_CATALOG.filter((s) => s.name !== anchorFamily).map((s) => {
                const on = addOns.some((a) => a.name === s.name)
                const h = history.get(s.name)
                return (
                  <button
                    key={s.name}
                    onClick={() => toggleAddOn(s.name)}
                    className={`text-xs font-medium rounded-full border px-3 py-1.5 transition-colors ${
                      on
                        ? "border-[#2D8C6F] bg-[#2D8C6F] text-white"
                        : "border-[#2D8C6F]/40 text-[#2D8C6F] hover:bg-[#2D8C6F]/10"
                    }`}
                  >
                    {on ? "✓ " : "+ "}
                    {s.name}
                    {h && !on && <span className="ml-1 opacity-70">({formatMoney(h.lastPrice)})</span>}
                  </button>
                )
              })}
            </div>
            {addOns.map((a) => (
              <div key={a.name} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{a.name}</p>
                  <button
                    onClick={() => toggleAddOn(a.name)}
                    className="p-1.5 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5 mt-2">
                  <div>
                    <label className="text-[11px] text-muted-foreground">Visits / year</label>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={a.visits_per_year}
                      onChange={(e) =>
                        updateAddOn(a.name, { visits_per_year: Math.max(1, Number(e.target.value)) })
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Price / visit ($)</label>
                    <input
                      type="number"
                      min={0}
                      step={25}
                      value={a.price_per_visit || ""}
                      onChange={(e) => updateAddOn(a.name, { price_per_visit: Number(e.target.value) })}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Billing */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Billing</p>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted">
              <button
                onClick={() => setBilling("paid_in_full")}
                className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                  billing === "paid_in_full" ? "bg-card shadow" : "text-muted-foreground"
                }`}
              >
                Paid in Full
              </button>
              <button
                onClick={() => setBilling("monthly")}
                className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                  billing === "monthly" ? "bg-card shadow" : "text-muted-foreground"
                }`}
              >
                Monthly
              </button>
            </div>
            {billing === "paid_in_full" && (
              <div className="w-40">
                <label className="text-[11px] text-muted-foreground">PIF discount (%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={pifDiscount}
                  onChange={(e) => setPifDiscount(Math.min(50, Math.max(0, Number(e.target.value))))}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {errorMsg && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}
        </>
      )}

      {/* THE PITCH — sticky, customer-facing */}
      {selected && anchorFamily && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="mx-auto max-w-5xl px-4 pb-3">
            <div className="rounded-2xl bg-[#0A0A0A] border border-[#2D8C6F]/40 px-5 py-4 shadow-2xl">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-white/50">One-time {anchorFamily.toLowerCase()}</span>
                <span className="text-white/50 line-through tabular-nums">
                  {formatMoney(oneTimePrice)}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-white font-semibold text-sm">
                  Member · {cadence.label.toLowerCase()}
                </span>
                <span className="text-[#2D8C6F] font-black text-xl tabular-nums">
                  {formatMoney(memberRate)}/visit
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                <div className="text-white/70 text-sm tabular-nums">
                  {formatMoney(pricing.monthlyPrice)}/mo
                  <span className="text-white/35"> · {formatMoney(pricing.annualValue)}/yr</span>
                </div>
                {billing === "paid_in_full" ? (
                  <div className="text-right">
                    <span className="text-white font-bold tabular-nums">
                      PIF {formatMoney(pricing.pifTotal)}
                    </span>
                    <span className="text-[#2D8C6F] text-xs font-semibold ml-2">
                      save {formatMoney(pricing.annualValue - pricing.pifTotal)}
                    </span>
                  </div>
                ) : (
                  <span className="text-white font-bold tabular-nums">
                    {formatMoney(pricing.monthlyPrice)}/mo
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-white/25 tabular-nums">
                  {perVisitSavings > 0 && `−${formatMoney(perVisitSavings)}/visit vs one-time`}
                  {billing === "paid_in_full" && effectiveFloor > 0 && (
                    <span> · floor {formatMoney(effectiveFloor)}/visit</span>
                  )}
                </p>
                <Button
                  onClick={createPlan}
                  disabled={submitting || services.length === 0}
                  className="bg-[#2D8C6F] hover:bg-[#1F6B54] text-white font-bold"
                >
                  {submitting ? "Creating..." : "Create Plan + Agreement"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
