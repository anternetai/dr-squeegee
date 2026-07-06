"use client"

import { useMemo, useState } from "react"
import { BRAND, CLUB_NAME, FONTS } from "@/lib/squeegee/brand"
import {
  isHighFrequencyPlan,
  monthKeyLabel,
  recommendMonth,
  rotationOptions,
  termMonthKeys,
  type PlanVisit,
  type SchedulePick,
  type SqueegeePlan,
} from "@/lib/squeegee/plans"

interface Props {
  plan: SqueegeePlan
  hasVisits: boolean
  onComplete: (visits: PlanVisit[]) => void
}

const CONFETTI_COLORS = ["#2D8C6F", "#E6F5F0", "#FFFFFF", "#1F6B54", "#E8B44A"]

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }).map((_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 10) * 0.18,
        duration: 2.6 + (i % 5) * 0.5,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + (i % 3) * 3,
        rot: (i * 47) % 360,
      })),
    []
  )
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      <style>{`@keyframes club-confetti { 0% { transform: translateY(-8vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(105vh) rotate(720deg); opacity: 0.4; } }`}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            background: p.color,
            borderRadius: 1,
            transform: `rotate(${p.rot}deg)`,
            animation: `club-confetti ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// Post-signing setup: pick months for the year, celebrate, create the Club
// login, then hand off to the tour. One decision per screen, recommended
// defaults preselected everywhere.
export function PortalOnboarding({ plan, hasVisits, onComplete }: Props) {
  const services = Array.isArray(plan.services) ? plan.services : []
  // High-frequency route plans (>12×/yr) are auto-scheduled server-side —
  // no month-picking, straight to celebration + account + tour.
  const autoScheduled = hasVisits || isHighFrequencyPlan(services)
  const recurring = autoScheduled ? [] : services.filter((s) => s.visits_per_year > 1)
  const oneOffs = autoScheduled ? [] : services.filter((s) => s.visits_per_year === 1)

  const termStart = useMemo(
    () => (plan.term_start ? new Date(plan.term_start + "T12:00:00") : new Date()),
    [plan.term_start]
  )
  const termKeys = useMemo(() => termMonthKeys(termStart), [termStart])

  // steps: welcome → each recurring → each one-off → review
  const steps = useMemo(() => {
    const list: { kind: "welcome" | "recurring" | "oneoff" | "review"; serviceIdx?: number }[] = [
      { kind: "welcome" },
    ]
    recurring.forEach((_, i) => list.push({ kind: "recurring", serviceIdx: i }))
    oneOffs.forEach((_, i) => list.push({ kind: "oneoff", serviceIdx: i }))
    if (!autoScheduled) list.push({ kind: "review" })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [stepIdx, setStepIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Post-lock-in phases: celebrate, then create the Club login
  const [phase, setPhase] = useState<"steps" | "congrats" | "account">("steps")
  const [lockedVisits, setLockedVisits] = useState<PlanVisit[]>([])
  const [acctEmail, setAcctEmail] = useState(plan.client_email ?? "")
  const [pw, setPw] = useState("")
  const [pw2, setPw2] = useState("")
  const [acctSubmitting, setAcctSubmitting] = useState(false)
  const [acctError, setAcctError] = useState<string | null>(null)
  const [memberInfo, setMemberInfo] = useState<{ member_number: number; slug: string | null } | null>(null)

  // Defaults: recommended rotation + recommended one-off months
  const [picks, setPicks] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {}
    const used: string[] = []
    for (const s of recurring) {
      const rec = rotationOptions(termKeys, s.visits_per_year)[0] ?? []
      initial[s.name] = rec
      used.push(...rec)
    }
    for (const s of oneOffs) {
      const rec = recommendMonth(s.name, termKeys, used)
      initial[s.name] = [rec.month]
      used.push(rec.month)
    }
    return initial
  })

  const firstName = plan.client_name.split(" ")[0]
  const step = steps[stepIdx]

  const allPicks: SchedulePick[] = services.map((s) => ({
    service_name: s.name,
    months: picks[s.name] ?? [],
  }))

  async function submit(picksToSend: SchedulePick[]) {
    if (submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/portal/${plan.portal_token}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: autoScheduled ? [] : picksToSend }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || "Something went wrong. Please try again.")
        return
      }
      setLockedVisits(json.visits as PlanVisit[])
      setPhase("congrats")
      window.scrollTo({ top: 0 })
    } catch {
      setErrorMsg("Network error — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault()
    if (acctSubmitting) return
    setAcctSubmitting(true)
    setAcctError(null)
    try {
      const res = await fetch(`/api/portal/${plan.portal_token}/account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: acctEmail, password: pw, confirm: pw2 }),
      })
      const json = await res.json()
      if (!res.ok) {
        setAcctError(json.error || "Something went wrong. Please try again.")
        return
      }
      setMemberInfo({ member_number: json.member_number, slug: json.slug })
    } catch {
      setAcctError("Network error — please try again.")
    } finally {
      setAcctSubmitting(false)
    }
  }

  function finish() {
    onComplete(lockedVisits)
  }

  function next() {
    if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1)
  }
  function back() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1)
  }

  // Chronological review list
  const reviewItems = services
    .flatMap((s) => (picks[s.name] ?? []).map((m) => ({ month: m, service: s.name })))
    .sort((a, b) => a.month.localeCompare(b.month))

  const dotCount = steps.length
  const usedByOthers = (name: string) =>
    Object.entries(picks)
      .filter(([k]) => k !== name)
      .flatMap(([, v]) => v)

  if (phase === "congrats") {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0A0A] overflow-y-auto" style={{ fontFamily: FONTS.body }}>
        <Confetti />
        <div className="max-w-lg mx-auto px-4 py-8 min-h-full flex flex-col justify-center text-center">
          <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-20 w-auto mx-auto mb-6" />
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#2D8C6F]">
            {CLUB_NAME}
          </p>
          <h1 className="text-3xl font-bold text-white mt-2" style={{ fontFamily: FONTS.display }}>
            Congratulations, {firstName}! 🎉
          </h1>
          <p className="text-white/60 mt-3 leading-relaxed">
            You&apos;re officially a Care Club member.{" "}
            {lockedVisits.length > 0
              ? `Your year is locked in — ${lockedVisits.length} visits on the calendar.`
              : "Your membership is active."}
          </p>
          <button
            onClick={() => setPhase("account")}
            className="mt-8 h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] text-white font-bold text-base transition-colors"
            style={{ fontFamily: FONTS.display }}
          >
            CONTINUE
          </button>
        </div>
      </div>
    )
  }

  if (phase === "account") {
    return (
      <div className="fixed inset-0 z-50 bg-[#0A0A0A] overflow-y-auto" style={{ fontFamily: FONTS.body }}>
        <div className="max-w-lg mx-auto px-4 py-8 min-h-full flex flex-col">
          {memberInfo ? (
            <div className="flex-1 flex flex-col justify-center text-center">
              {/* Membership card reveal */}
              <div className="rounded-2xl bg-gradient-to-br from-[#111111] to-[#1A1A1A] border border-[#2D8C6F]/40 px-6 py-6 text-left shadow-2xl">
                <div className="flex items-center justify-between">
                  <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-10 w-auto" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2D8C6F]">
                    {CLUB_NAME}
                  </p>
                </div>
                <p className="text-xl font-bold text-white mt-5" style={{ fontFamily: FONTS.display }}>
                  {plan.client_name}
                </p>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40">Member No.</p>
                    <p className="text-lg font-bold text-[#2D8C6F] tabular-nums" style={{ fontFamily: FONTS.display }}>
                      #{String(memberInfo.member_number).padStart(4, "0")}
                    </p>
                  </div>
                  <p className="text-[11px] text-white/40">
                    Since{" "}
                    {new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              {memberInfo.slug && (
                <p className="text-sm text-white/60 mt-5">
                  Your personal link:{" "}
                  <span className="text-[#2D8C6F] font-semibold">
                    drsqueegeeclt.com/portal/{memberInfo.slug}
                  </span>
                </p>
              )}
              <p className="text-xs text-white/40 mt-2">
                Your login details were just emailed to you.
              </p>
              <button
                onClick={finish}
                className="mt-8 h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] text-white font-bold text-base transition-colors"
                style={{ fontFamily: FONTS.display }}
              >
                CONTINUE TO MY PORTAL
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center">
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: FONTS.display }}>
                Create your Club login
              </h1>
              <p className="text-white/50 text-sm mt-2 leading-relaxed">
                Sign in from any device at drsqueegeeclt.com/portal. Your phone will offer
                to save it for you.
              </p>
              <form onSubmit={submitAccount} className="mt-6 space-y-3">
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={acctEmail}
                  onChange={(e) => setAcctEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="w-full h-13 px-4 py-3.5 rounded-xl bg-[#111111] border border-[#242424] text-white text-base placeholder:text-white/25 focus:outline-none focus:border-[#2D8C6F]"
                />
                <input
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="Password (8+ characters)"
                  minLength={8}
                  required
                  className="w-full h-13 px-4 py-3.5 rounded-xl bg-[#111111] border border-[#242424] text-white text-base placeholder:text-white/25 focus:outline-none focus:border-[#2D8C6F]"
                />
                <input
                  type="password"
                  name="confirm-password"
                  autoComplete="new-password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder="Confirm password"
                  minLength={8}
                  required
                  className="w-full h-13 px-4 py-3.5 rounded-xl bg-[#111111] border border-[#242424] text-white text-base placeholder:text-white/25 focus:outline-none focus:border-[#2D8C6F]"
                />
                {acctError && <p className="text-sm text-[#E87B6F]">{acctError}</p>}
                <button
                  type="submit"
                  disabled={acctSubmitting}
                  className="w-full h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] text-white font-bold text-base transition-colors disabled:opacity-50"
                  style={{ fontFamily: FONTS.display }}
                >
                  {acctSubmitting ? "CREATING..." : "CREATE MY LOGIN"}
                </button>
              </form>
              <button
                onClick={finish}
                className="mt-3 text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                I&apos;ll do this later
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0A0A0A] overflow-y-auto"
      style={{ fontFamily: FONTS.body }}
    >
      <div className="max-w-lg mx-auto px-4 py-8 min-h-full flex flex-col">
        {/* Progress + back */}
        <div className="flex items-center justify-between mb-8">
          {stepIdx > 0 ? (
            <button onClick={back} className="text-white/50 text-sm hover:text-white transition-colors">
              &larr; Back
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-1.5">
            {Array.from({ length: dotCount }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIdx ? "w-6 bg-[#2D8C6F]" : i < stepIdx ? "w-1.5 bg-[#2D8C6F]/60" : "w-1.5 bg-white/15"
                }`}
              />
            ))}
          </div>
          <span className="w-10" />
        </div>

        {/* WELCOME */}
        {step.kind === "welcome" && (
          <div className="flex-1 flex flex-col justify-center text-center">
            <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-20 w-auto mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: FONTS.display }}>
              Welcome to the family, {firstName}!
            </h1>
            <p className="text-white/60 mt-3 leading-relaxed">
              {hasVisits
                ? "Your year is already mapped out. Let us show you around your member portal — it takes 30 seconds."
                : autoScheduled
                  ? "Your plan is signed and your route schedule is set automatically — evenly spaced visits, all year. Let us show you around your member portal."
                  : "Your plan is signed. Now the fun part: let's map out your year of service. Takes about a minute, and you can change any of it later."}
            </p>
            <button
              onClick={autoScheduled ? () => submit([]) : next}
              disabled={submitting}
              className="mt-8 h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] text-white font-bold text-base transition-colors disabled:opacity-50"
              style={{ fontFamily: FONTS.display }}
            >
              {autoScheduled ? (submitting ? "ONE SEC..." : "SHOW ME AROUND") : "LET'S MAP MY YEAR"}
            </button>
            {!autoScheduled && (
              <button
                onClick={() => submit(allPicks)}
                disabled={submitting}
                className="mt-3 text-sm text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
              >
                {submitting ? "Setting up..." : "Skip — use the recommended schedule"}
              </button>
            )}
            {errorMsg && <p className="mt-4 text-sm text-[#E87B6F]">{errorMsg}</p>}
          </div>
        )}

        {/* RECURRING (rotation pick) */}
        {step.kind === "recurring" && (() => {
          const svc = recurring[step.serviceIdx!]
          const options = rotationOptions(termKeys, svc.visits_per_year)
          const selected = picks[svc.name] ?? []
          return (
            <div className="flex-1 flex flex-col">
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: FONTS.display }}>
                Pick your {svc.name.toLowerCase()} rotation
              </h1>
              <p className="text-white/50 text-sm mt-2">
                {svc.visits_per_year} visits, evenly spaced. We&apos;ll confirm the exact day with you
                before each one.
              </p>
              <div className="mt-6 space-y-3">
                {options.map((option, i) => {
                  const isSelected = JSON.stringify(option) === JSON.stringify(selected)
                  return (
                    <button
                      key={i}
                      onClick={() => setPicks((p) => ({ ...p, [svc.name]: option }))}
                      className={`w-full rounded-xl border px-4 py-4 text-left transition-colors ${
                        isSelected
                          ? "border-[#2D8C6F] bg-[#2D8C6F]/10"
                          : "border-[#242424] bg-[#111111] hover:border-white/25"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`font-bold ${isSelected ? "text-[#2D8C6F]" : "text-white"}`}>
                          {option.map((k) => monthKeyLabel(k).split(" ")[0]).join(" · ")}
                        </p>
                        {i === 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#2D8C6F] bg-[#2D8C6F]/10 rounded-full px-2 py-1">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        First visit {monthKeyLabel(option[0])}
                      </p>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={next}
                className="mt-auto pt-8 pb-2 sticky bottom-0"
              >
                <span
                  className="block h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] text-white font-bold text-base leading-[3.5rem] transition-colors"
                  style={{ fontFamily: FONTS.display }}
                >
                  NEXT
                </span>
              </button>
            </div>
          )
        })()}

        {/* ONE-OFF (month pick) */}
        {step.kind === "oneoff" && (() => {
          const svc = oneOffs[step.serviceIdx!]
          const rec = recommendMonth(svc.name, termKeys, usedByOthers(svc.name))
          const selected = picks[svc.name]?.[0]
          return (
            <div className="flex-1 flex flex-col">
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: FONTS.display }}>
                When should we do your {svc.name.toLowerCase()}?
              </h1>
              {svc.description && (
                <p className="text-white/50 text-sm mt-2">{svc.description}</p>
              )}
              <div className="mt-6 grid grid-cols-3 gap-2">
                {termKeys.map((key) => {
                  const isSelected = selected === key
                  const isRec = rec.month === key
                  const taken = usedByOthers(svc.name).includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => setPicks((p) => ({ ...p, [svc.name]: [key] }))}
                      className={`relative h-14 rounded-xl border text-sm font-semibold transition-colors ${
                        isSelected
                          ? "border-[#2D8C6F] bg-[#2D8C6F]/15 text-[#2D8C6F]"
                          : "border-[#242424] bg-[#111111] text-white/80 hover:border-white/25"
                      }`}
                    >
                      {monthKeyLabel(key).split(" ")[0]}
                      <span className="block text-[10px] font-normal text-white/30">
                        {key.slice(0, 4)}
                      </span>
                      {isRec && (
                        <span className="absolute -top-1.5 -right-1.5 text-[10px]">&#11088;</span>
                      )}
                      {taken && !isSelected && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2D8C6F]/60" />
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="text-sm text-[#2D8C6F] mt-4 min-h-[2.5rem]">
                {selected === rec.month
                  ? `⭐ ${rec.reason}`
                  : selected
                    ? `${monthKeyLabel(selected)} it is — we'll make it work great.`
                    : ""}
              </p>
              <button onClick={next} className="mt-auto pt-6 pb-2 sticky bottom-0">
                <span
                  className="block h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] text-white font-bold text-base leading-[3.5rem] transition-colors"
                  style={{ fontFamily: FONTS.display }}
                >
                  NEXT
                </span>
              </button>
            </div>
          )
        })()}

        {/* REVIEW */}
        {step.kind === "review" && (
          <div className="flex-1 flex flex-col">
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: FONTS.display }}>
              Your year, at a glance
            </h1>
            <p className="text-white/50 text-sm mt-2">
              We&apos;ll text you before each visit to confirm the exact day. You can reschedule
              anytime from this portal.
            </p>
            <div className="mt-6 rounded-2xl bg-[#111111] border border-[#242424] divide-y divide-[#242424]">
              {reviewItems.map((item, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <span className="w-20 shrink-0 text-sm font-bold text-[#2D8C6F]" style={{ fontFamily: FONTS.display }}>
                    {monthKeyLabel(item.month).split(" ")[0]} {item.month.slice(2, 4)}&apos;
                  </span>
                  <span className="text-sm text-white/85">{item.service}</span>
                </div>
              ))}
            </div>
            {errorMsg && <p className="mt-4 text-sm text-[#E87B6F]">{errorMsg}</p>}
            <button
              onClick={() => submit(allPicks)}
              disabled={submitting}
              className="mt-auto pt-8 pb-2 sticky bottom-0"
            >
              <span
                className="block h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] text-white font-bold text-base leading-[3.5rem] transition-colors"
                style={{ fontFamily: FONTS.display }}
              >
                {submitting ? "LOCKING IT IN..." : "LOCK IN MY YEAR ✨"}
              </span>
            </button>
            <a
              href={`sms:${BRAND.phoneTel}`}
              className="text-center text-xs text-white/35 hover:text-white/60 transition-colors pb-2"
            >
              Questions first? Text us — {BRAND.phone}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
