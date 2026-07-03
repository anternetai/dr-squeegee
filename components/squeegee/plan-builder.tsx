"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, UserRound } from "lucide-react"
import {
  computePlanPricing,
  DEFAULT_PIF_DISCOUNT,
  formatMoney,
  PLAN_SERVICE_CATALOG,
  totalVisits,
  type PlanBilling,
  type PlanService,
} from "@/lib/squeegee/plans"

interface ClientOption {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
}

interface Props {
  clients: ClientOption[]
}

export function PlanBuilder({ clients }: Props) {
  const router = useRouter()
  const [clientId, setClientId] = useState("")
  const [clientName, setClientName] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [address, setAddress] = useState("")
  const [services, setServices] = useState<PlanService[]>([])
  const [billing, setBilling] = useState<PlanBilling>("paid_in_full")
  const [discount, setDiscount] = useState(DEFAULT_PIF_DISCOUNT)
  const [termStart, setTermStart] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const pricing = useMemo(() => computePlanPricing(services, discount), [services, discount])
  const visits = totalVisits(services)
  const availableCatalog = PLAN_SERVICE_CATALOG.filter(
    (c) => !services.some((s) => s.name === c.name)
  )

  function selectClient(id: string) {
    setClientId(id)
    const c = clients.find((cl) => cl.id === id)
    if (c) {
      setClientName(c.name)
      setClientPhone(c.phone ?? "")
      setClientEmail(c.email ?? "")
      setAddress(c.address ?? "")
    }
  }

  function addService(svc: PlanService) {
    setServices((prev) => [...prev, { ...svc }])
  }

  function addCustomService() {
    setServices((prev) => [
      ...prev,
      { name: "", description: "", visits_per_year: 1, price_per_visit: 0 },
    ])
  }

  function updateService(i: number, patch: Partial<PlanService>) {
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  function removeService(i: number) {
    setServices((prev) => prev.filter((_, idx) => idx !== i))
  }

  const canCreate =
    clientName.trim().length > 1 &&
    address.trim().length > 3 &&
    services.length > 0 &&
    services.every((s) => s.name.trim() && s.visits_per_year > 0 && s.price_per_visit > 0)

  async function handleCreate() {
    if (!canCreate || submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch("/api/squeegee/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId || undefined,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim() || undefined,
          client_email: clientEmail.trim() || undefined,
          address: address.trim(),
          services,
          billing,
          discount_percent: discount,
          term_start: termStart || undefined,
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
    <div className="space-y-5 pb-32">
      <div>
        <h1 className="text-2xl font-bold">New Annual Plan</h1>
        <p className="text-sm text-muted-foreground">
          Add services, watch the price build, send the agreement.
        </p>
      </div>

      {/* Customer */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Customer
        </p>
        {clients.length > 0 && (
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={clientId}
              onChange={(e) => selectClient(e.target.value)}
              className={inputCls}
            >
              <option value="">Pick existing client (or type below)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.address ? ` — ${c.address}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Name *" className={inputCls} />
          <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Phone" className={inputCls} />
        </div>
        <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Email" className={inputCls} />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Service address *" className={inputCls} />
      </div>

      {/* Services */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Services &middot; {visits} visit{visits !== 1 ? "s" : ""}/year
        </p>

        {services.map((s, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                value={s.name}
                onChange={(e) => updateService(i, { name: e.target.value })}
                placeholder="Service name"
                className={`${inputCls} font-medium`}
              />
              <button
                onClick={() => removeService(i)}
                className="p-2 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-muted-foreground">Visits / year</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={s.visits_per_year}
                  onChange={(e) => updateService(i, { visits_per_year: Math.max(1, Number(e.target.value)) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Price / visit ($)</label>
                <input
                  type="number"
                  min={0}
                  step={25}
                  value={s.price_per_visit || ""}
                  onChange={(e) => updateService(i, { price_per_visit: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            </div>
            <p className="text-right text-xs text-muted-foreground tabular-nums">
              = {formatMoney(s.visits_per_year * s.price_per_visit)}/year
            </p>
          </div>
        ))}

        {availableCatalog.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {availableCatalog.map((c) => (
              <button
                key={c.name}
                onClick={() => addService(c)}
                className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full border border-[#2D8C6F]/40 text-[#2D8C6F] px-3 py-1.5 hover:bg-[#2D8C6F]/10 transition-colors"
              >
                <Plus className="h-3 w-3" />
                {c.name}
              </button>
            ))}
            <button
              onClick={addCustomService}
              className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full border border-border text-muted-foreground px-3 py-1.5 hover:bg-muted transition-colors"
            >
              <Plus className="h-3 w-3" />
              Custom
            </button>
          </div>
        )}
      </div>

      {/* Billing */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Billing
        </p>
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
        <div className="grid grid-cols-2 gap-3">
          {billing === "paid_in_full" && (
            <div>
              <label className="text-[11px] text-muted-foreground">PIF discount (%)</label>
              <input
                type="number"
                min={0}
                max={50}
                value={discount}
                onChange={(e) => setDiscount(Math.min(50, Math.max(0, Number(e.target.value))))}
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label className="text-[11px] text-muted-foreground">Term start (optional)</label>
            <input
              type="date"
              value={termStart}
              onChange={(e) => setTermStart(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {errorMsg && <p className="text-sm text-red-500 font-medium">{errorMsg}</p>}

      {/* Sticky pricing bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur z-40">
        <div className="container mx-auto px-4 max-w-5xl py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-baseline gap-4 min-w-0">
              <div>
                <p className="text-[11px] text-muted-foreground">Annual value</p>
                <p className="font-bold tabular-nums">{formatMoney(pricing.annualValue)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Monthly</p>
                <p className="font-bold tabular-nums">{formatMoney(pricing.monthlyPrice)}/mo</p>
              </div>
              <div>
                <p className="text-[11px] text-[#2D8C6F]">PIF ({discount}% off)</p>
                <p className="font-black text-[#2D8C6F] tabular-nums text-lg">
                  {formatMoney(pricing.pifTotal)}
                </p>
              </div>
            </div>
            <Button onClick={handleCreate} disabled={!canCreate || submitting} size="lg">
              {submitting ? "Creating..." : "Create Plan"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
