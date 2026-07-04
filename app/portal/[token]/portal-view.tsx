"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { BRAND, CLUB_NAME, FONTS } from "@/lib/squeegee/brand"
import {
  formatMoney,
  RESCHEDULE_MIN_NOTICE_HOURS,
  RESCHEDULE_WINDOW_DAYS,
  type PlanVisit,
  type SqueegeePlan,
} from "@/lib/squeegee/plans"
import { PortalOnboarding } from "./onboarding"

export interface PortalMember {
  member_number: number
  slug: string | null
  email: string
  created_at: string
}

interface Props {
  plan: SqueegeePlan
  initialVisits: PlanVisit[]
  member: PortalMember | null
}

const TOUR_STEPS = [
  {
    title: "Your next visit, always front and center",
    body: "We'll text you before every visit to confirm the exact day — no surprises.",
  },
  {
    title: "Life happens — reschedule in two taps",
    body: `Tap Reschedule on any visit to move it, up to ${RESCHEDULE_MIN_NOTICE_HOURS} hours before.`,
  },
  {
    title: "A real human, one tap away",
    body: "Questions, special requests, anything — call or text us right from here.",
  },
] as const

function formatVisitDate(dateStr: string | null): string {
  if (!dateStr) return "Date coming soon"
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function PortalView({ plan, initialVisits, member }: Props) {
  const router = useRouter()
  const [visits, setVisits] = useState(initialVisits)
  const [showOnboarding, setShowOnboarding] = useState(
    Boolean(plan.signed_at) && !plan.onboarded_at
  )
  const [tourStep, setTourStep] = useState<number | null>(null)
  const [afterTourHomescreen, setAfterTourHomescreen] = useState(false)
  const [homescreenOpen, setHomescreenOpen] = useState(false)
  const [device, setDevice] = useState<"iphone" | "android" | null>(null)
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null)
  const [newDate, setNewDate] = useState("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const heroRef = useRef<HTMLDivElement>(null)
  const upcomingRef = useRef<HTMLDivElement>(null)
  const contactRef = useRef<HTMLDivElement>(null)
  const tourRefs = [heroRef, upcomingRef, contactRef]

  useEffect(() => {
    if (tourStep === null) return
    tourRefs[tourStep]?.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep])

  const firstName = plan.client_name.split(" ")[0]
  const services = Array.isArray(plan.services) ? plan.services : []
  const todayISO = new Date().toISOString().slice(0, 10)

  const upcoming = visits.filter(
    (v) => v.status !== "completed" && v.status !== "skipped" && (v.scheduled_date ?? "9999") >= todayISO
  )
  const past = visits.filter(
    (v) => v.status === "completed" || v.status === "skipped" || (v.scheduled_date ?? "9999") < todayISO
  )
  const nextVisit = upcoming[0] ?? null
  const completedCount = visits.filter((v) => v.status === "completed").length

  function handleOnboardingComplete(newVisits: PlanVisit[]) {
    if (newVisits.length > 0) setVisits(newVisits)
    setShowOnboarding(false)
    setAfterTourHomescreen(true)
    setTourStep(0)
    window.scrollTo({ top: 0 })
    router.refresh()
  }

  function endTour() {
    setTourStep(null)
    if (afterTourHomescreen) {
      setAfterTourHomescreen(false)
      setHomescreenOpen(true)
      setDevice(null)
    }
  }

  async function logout() {
    await fetch("/api/portal/auth/logout", { method: "POST" })
    router.push("/portal/login")
    router.refresh()
  }

  function tourClass(step: number) {
    return tourStep === step ? "relative z-[60] ring-2 ring-[#2D8C6F] rounded-2xl" : ""
  }

  async function submitReschedule(visitId: string) {
    if (!newDate || submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/portal/${plan.portal_token}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visit_id: visitId, requested_date: newDate, note }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || "Something went wrong. Please try again.")
        return
      }
      setVisits((prev) => prev.map((v) => (v.id === visitId ? (json.visit as PlanVisit) : v)))
      setRescheduleFor(null)
      setNewDate("")
      setNote("")
    } catch {
      setErrorMsg("Network error — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  function VisitCard({ visit, showActions }: { visit: PlanVisit; showActions: boolean }) {
    const isOpen = rescheduleFor === visit.id
    return (
      <div className="rounded-xl bg-[#111111] border border-[#242424] px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">
              {visit.service_name}
              {visit.seq > 1 || visit.service_name.includes("Window") ? (
                <span className="ml-2 text-[11px] text-white/40 font-normal">#{visit.seq}</span>
              ) : null}
            </p>
            <p className="text-xs text-white/50 mt-0.5">{formatVisitDate(visit.scheduled_date)}</p>
            {visit.status === "reschedule_requested" && visit.reschedule_requested_date && (
              <p className="text-xs text-[#E8B44A] mt-1">
                Reschedule requested &rarr; {formatVisitDate(visit.reschedule_requested_date)} — we&apos;ll
                confirm shortly
              </p>
            )}
          </div>
          <div className="shrink-0">
            {visit.status === "completed" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2D8C6F] bg-[#2D8C6F]/10 rounded-full px-2.5 py-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                Done
              </span>
            ) : visit.status === "reschedule_requested" ? (
              <span className="text-[11px] font-bold text-[#E8B44A] bg-[#E8B44A]/10 rounded-full px-2.5 py-1">
                Pending
              </span>
            ) : showActions && visit.scheduled_date ? (
              <button
                onClick={() => {
                  setRescheduleFor(isOpen ? null : visit.id)
                  setNewDate("")
                  setNote("")
                  setErrorMsg(null)
                }}
                className="text-[11px] font-semibold text-white/60 border border-[#242424] rounded-full px-3 py-1.5 hover:text-white hover:border-white/30 transition-colors"
              >
                {isOpen ? "Close" : "Reschedule"}
              </button>
            ) : null}
          </div>
        </div>

        {isOpen && (
          <div className="mt-3 pt-3 border-t border-[#242424] space-y-2.5">
            <p className="text-xs text-white/40">
              Pick a new date within {RESCHEDULE_WINDOW_DAYS} days of the original, at least{" "}
              {RESCHEDULE_MIN_NOTICE_HOURS} hours ahead.
            </p>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full h-11 px-3 rounded-lg bg-[#1A1A1A] border border-[#242424] text-white text-sm focus:outline-none focus:border-[#2D8C6F] [color-scheme:dark]"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything we should know? (optional)"
              className="w-full h-11 px-3 rounded-lg bg-[#1A1A1A] border border-[#242424] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[#2D8C6F]"
            />
            {errorMsg && <p className="text-xs text-[#E87B6F]">{errorMsg}</p>}
            <button
              onClick={() => submitReschedule(visit.id)}
              disabled={!newDate || submitting}
              className="w-full h-11 rounded-lg bg-[#2D8C6F] hover:bg-[#1F6B54] text-white text-sm font-bold transition-colors disabled:opacity-40"
            >
              {submitting ? "Sending..." : "Request New Date"}
            </button>
          </div>
        )}
      </div>
    )
  }

  if (showOnboarding) {
    return (
      <PortalOnboarding
        plan={plan}
        hasVisits={initialVisits.length > 0}
        onComplete={handleOnboardingComplete}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] py-8 px-4" style={{ fontFamily: FONTS.body }}>
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <img
            src="/images/squeegee/logo-badge.png"
            alt="Dr. Squeegee"
            className="h-14 w-auto mx-auto mb-3"
          />
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: FONTS.display }}>
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-white/50 mt-1">{plan.address}</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#2D8C6F]/10 border border-[#2D8C6F]/30 px-3.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2D8C6F]" />
            <span className="text-xs font-bold text-[#2D8C6F] uppercase tracking-widest">
              {CLUB_NAME}
              {plan.billing === "paid_in_full" ? " · Paid in Full" : ""}
            </span>
          </div>
        </div>

        {/* Finish-login banner */}
        {!member && plan.signed_at && (
          <button
            onClick={() => setShowOnboarding(true)}
            className="w-full rounded-xl border border-[#E8B44A]/40 bg-[#E8B44A]/10 px-4 py-3 text-left"
          >
            <p className="text-sm font-semibold text-[#E8B44A]">Finish setting up your login</p>
            <p className="text-xs text-white/50 mt-0.5">
              Create your Club login so you can sign in from any device — takes 30 seconds.
            </p>
          </button>
        )}

        {/* Next visit hero */}
        {nextVisit && (
          <div ref={heroRef} className={tourClass(0)}>
            <div className="rounded-2xl bg-gradient-to-br from-[#2D8C6F] to-[#1F6B54] px-5 py-5">
              <p className="text-[11px] uppercase tracking-widest text-white/60 font-bold">
                Your next visit
              </p>
              <p className="text-2xl font-black text-white mt-1" style={{ fontFamily: FONTS.display }}>
                {nextVisit.service_name}
              </p>
              <p className="text-sm text-white/80 mt-0.5">{formatVisitDate(nextVisit.scheduled_date)}</p>
            </div>
          </div>
        )}

        {/* Membership card */}
        {member && (
          <div className="rounded-2xl bg-gradient-to-br from-[#111111] to-[#1A1A1A] border border-[#2D8C6F]/40 px-5 py-5">
            <div className="flex items-center justify-between">
              <img src="/images/squeegee/logo-badge.png" alt="" className="h-9 w-auto" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2D8C6F]">
                {CLUB_NAME}
              </p>
            </div>
            <p className="text-lg font-bold text-white mt-4" style={{ fontFamily: FONTS.display }}>
              {plan.client_name}
            </p>
            <div className="flex items-end justify-between mt-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40">Member No.</p>
                <p className="text-base font-bold text-[#2D8C6F] tabular-nums" style={{ fontFamily: FONTS.display }}>
                  #{String(member.member_number).padStart(4, "0")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-white/40">Member since</p>
                <p className="text-xs text-white/70">
                  {new Date(member.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </p>
              </div>
            </div>
            {member.slug && (
              <p className="text-[11px] text-white/35 mt-3 pt-3 border-t border-[#242424]">
                Your personal link:{" "}
                <span className="text-[#2D8C6F]">drsqueegeeclt.com/portal/{member.slug}</span>
              </p>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="rounded-2xl bg-[#111111] border border-[#242424] px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Plan progress</p>
            <p className="text-xs text-white/50 tabular-nums">
              {completedCount} of {visits.length} visits
            </p>
          </div>
          <div className="h-2 rounded-full bg-[#1A1A1A] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#2D8C6F] transition-all"
              style={{ width: visits.length ? `${(completedCount / visits.length) * 100}%` : "0%" }}
            />
          </div>
          {plan.term_start && plan.term_end && (
            <p className="text-[11px] text-white/30 mt-2">
              Plan year: {formatVisitDate(plan.term_start)} &ndash; {formatVisitDate(plan.term_end)}
            </p>
          )}
        </div>

        {/* Upcoming */}
        <div ref={upcomingRef} className={`space-y-2.5 ${tourClass(1)}`}>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest" style={{ fontFamily: FONTS.display }}>
            Upcoming Visits
          </h2>
          {upcoming.length > 0 ? (
            upcoming.map((v) => <VisitCard key={v.id} visit={v} showActions />)
          ) : (
            <p className="text-sm text-white/40 py-2">
              No upcoming visits — we&apos;ll reach out when it&apos;s time to schedule.
            </p>
          )}
        </div>

        {/* Past */}
        {past.length > 0 && (
          <div className="space-y-2.5">
            <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest" style={{ fontFamily: FONTS.display }}>
              History
            </h2>
            {past.map((v) => (
              <VisitCard key={v.id} visit={v} showActions={false} />
            ))}
          </div>
        )}

        {/* Plan summary */}
        <div className="rounded-2xl bg-[#111111] border border-[#242424] px-5 py-4">
          <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">
            What&apos;s in your plan
          </p>
          <div className="space-y-2">
            {services.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-white/80">{s.name}</span>
                <span className="text-white/40 tabular-nums">{s.visits_per_year}&times;/year</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[#242424] flex items-center justify-between">
            <span className="text-sm text-white/50">
              {formatMoney(plan.annual_value)} value
            </span>
            <span className="text-sm font-bold text-[#2D8C6F]">
              You pay {formatMoney(plan.total_price)}
              {plan.billing === "monthly" ? "/yr" : ""}
            </span>
          </div>
        </div>

        {/* Contact */}
        <div ref={contactRef} className={tourClass(2)}>
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`tel:${BRAND.phoneTel}`}
              className="h-12 rounded-xl bg-[#111111] border border-[#242424] flex items-center justify-center gap-2 text-sm font-semibold text-white hover:border-[#2D8C6F]/50 transition-colors"
            >
              <svg className="w-4 h-4 text-[#2D8C6F]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.4 11.4 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z"/></svg>
              Call us
            </a>
            <a
              href={`sms:${BRAND.phoneTel}`}
              className="h-12 rounded-xl bg-[#111111] border border-[#242424] flex items-center justify-center gap-2 text-sm font-semibold text-white hover:border-[#2D8C6F]/50 transition-colors"
            >
              <svg className="w-4 h-4 text-[#2D8C6F]" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 00-2 2v18l4-4h14a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg>
              Text us
            </a>
          </div>
        </div>

        {/* Footer — account + homescreen */}
        <div className="rounded-2xl bg-[#111111] border border-[#242424] divide-y divide-[#242424]">
          <button
            onClick={() => {
              setHomescreenOpen(true)
              setDevice(null)
            }}
            className="w-full px-5 py-3.5 text-left text-sm text-white/70 hover:text-white transition-colors"
          >
            &#128241; Add this portal to your home screen
          </button>
          {member && (
            <div className="px-5 py-3.5 flex items-center justify-between">
              <p className="text-xs text-white/40 truncate">{member.email}</p>
              <button
                onClick={logout}
                className="text-xs text-white/50 hover:text-white transition-colors shrink-0 ml-3"
              >
                Log out
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/25 pb-4" style={{ fontFamily: FONTS.display }}>
          {BRAND.name} &middot; {BRAND.tagline}
        </p>
      </div>

      {/* Tour overlay */}
      {tourStep !== null && (
        <>
          <div className="fixed inset-0 z-50 bg-black/70" onClick={endTour} />
          <div className="fixed bottom-4 left-4 right-4 z-[70] max-w-lg mx-auto">
            <div className="rounded-2xl bg-white px-5 py-4 shadow-2xl">
              <p className="text-sm font-bold text-[#0A0A0A]" style={{ fontFamily: FONTS.display }}>
                {TOUR_STEPS[tourStep].title}
              </p>
              <p className="text-xs text-[#2B2B2B]/60 mt-1 leading-relaxed">
                {TOUR_STEPS[tourStep].body}
              </p>
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={endTour}
                  className="text-xs text-[#2B2B2B]/40 hover:text-[#2B2B2B]/70 transition-colors"
                >
                  Skip tour
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {TOUR_STEPS.map((_, i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${i === tourStep ? "bg-[#2D8C6F]" : "bg-[#2B2B2B]/15"}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      tourStep < TOUR_STEPS.length - 1 ? setTourStep(tourStep + 1) : endTour()
                    }
                    className="h-9 px-4 rounded-lg bg-[#2D8C6F] hover:bg-[#1F6B54] text-white text-xs font-bold transition-colors"
                  >
                    {tourStep < TOUR_STEPS.length - 1 ? "Next" : "Got it!"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add-to-homescreen sheet */}
      {homescreenOpen && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/70" onClick={() => setHomescreenOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[90] max-w-lg mx-auto">
            <div className="rounded-t-3xl bg-[#111111] border border-[#242424] px-5 pt-5 pb-8">
              <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-4" />
              {device === null ? (
                <>
                  <p className="text-lg font-bold text-white text-center" style={{ fontFamily: FONTS.display }}>
                    Put your portal one tap away
                  </p>
                  <p className="text-sm text-white/50 text-center mt-1">
                    Save it to your home screen like an app. Which phone do you have?
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-5">
                    <button
                      onClick={() => setDevice("iphone")}
                      className="h-20 rounded-2xl bg-[#0A0A0A] border border-[#242424] hover:border-[#2D8C6F]/60 transition-colors text-white font-semibold"
                    >
                      <span className="text-2xl block mb-1">&#63743;</span>
                      iPhone
                    </button>
                    <button
                      onClick={() => setDevice("android")}
                      className="h-20 rounded-2xl bg-[#0A0A0A] border border-[#242424] hover:border-[#2D8C6F]/60 transition-colors text-white font-semibold"
                    >
                      <span className="text-2xl block mb-1">&#129302;</span>
                      Android
                    </button>
                  </div>
                  <button
                    onClick={() => setHomescreenOpen(false)}
                    className="w-full text-center text-xs text-white/35 hover:text-white/60 mt-4"
                  >
                    Maybe later
                  </button>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-white text-center" style={{ fontFamily: FONTS.display }}>
                    {device === "iphone" ? "On your iPhone" : "On your Android"}
                  </p>
                  <ol className="mt-4 space-y-3">
                    {(device === "iphone"
                      ? [
                          <>Tap the <strong className="text-white">Share</strong> button in Safari — the square with the arrow &#8593; at the bottom of your screen</>,
                          <>Scroll down and tap <strong className="text-white">&ldquo;Add to Home Screen&rdquo;</strong></>,
                          <>Tap <strong className="text-white">Add</strong> — that&apos;s it! Look for the Dr. Squeegee badge on your home screen</>,
                        ]
                      : [
                          <>Tap the <strong className="text-white">&#8942; menu</strong> in the top-right corner of Chrome</>,
                          <>Tap <strong className="text-white">&ldquo;Add to Home screen&rdquo;</strong> (or &ldquo;Install app&rdquo;)</>,
                          <>Tap <strong className="text-white">Add</strong> — done! The Club is now on your home screen</>,
                        ]
                    ).map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm text-white/70 leading-relaxed">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-[#2D8C6F] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <button
                    onClick={() => setHomescreenOpen(false)}
                    className="w-full h-12 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] text-white font-bold text-sm mt-5 transition-colors"
                    style={{ fontFamily: FONTS.display }}
                  >
                    DONE — I&apos;M ALL SET
                  </button>
                  <button
                    onClick={() => setDevice(null)}
                    className="w-full text-center text-xs text-white/35 hover:text-white/60 mt-3"
                  >
                    &larr; Other phone
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
