"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, ShieldCheck, Heart } from "lucide-react"
import { DAYS } from "@/lib/squeegee/employees"
import { MISSION, VALUES, EXPECTATIONS } from "@/lib/squeegee/company"

interface Prefill {
  name: string
  phone: string
  email: string
  address: string
  emergency_contact_name: string
  emergency_contact_phone: string
  availability: Record<string, boolean>
}

const inputCls =
  "w-full rounded-xl bg-[#111111] border border-[#242424] px-4 py-3 text-white outline-none focus:border-[#2D8C6F] placeholder:text-gray-600"

// W-2 acknowledgment — values + at-will employment. The legal W-4/I-9/tax forms
// are handled in Gusto, not here. Anthony: have this wording reviewed before real use.
const AGREEMENT = `As a Dr. Squeegee crew member, I agree to live out our values on the job: to leave every property better than I found it, to work whole-souled, to be honest in all things, to treat people and their property with respect, and to be skilled and dependable. I understand I'll complete my tax and payroll paperwork (W-4, I-9, direct deposit) through Gusto, that my employment is at-will — meaning either I or the company may end it at any time — and that I'll follow Dr. Squeegee's standards and safety practices.`

export function CrewOnboarding({ token, prefill }: { token: string; prefill: Prefill }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    legal_name: prefill.name,
    phone: prefill.phone,
    email: prefill.email,
    address: prefill.address,
    emergency_contact_name: prefill.emergency_contact_name,
    emergency_contact_phone: prefill.emergency_contact_phone,
    availability: prefill.availability,
    signature: "",
    agreed: false,
    password: "",
    confirm: "",
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const first = prefill.name.trim().split(/\s+/)[0]
  const TOTAL = 7 // steps 0..6, success = 7

  function toggleDay(key: string) {
    setForm((f) => ({ ...f, availability: { ...f.availability, [key]: !f.availability[key] } }))
  }

  function next() {
    setError(null)
    if (step === 3 && !form.email.trim()) {
      setError("We need an email so you can log in.")
      return
    }
    if (step === 5) {
      if (!form.agreed) {
        setError("Please check the box to agree.")
        return
      }
      if (!form.signature.trim()) {
        setError("Type your full name to sign.")
        return
      }
    }
    setStep((s) => s + 1)
  }

  async function finish() {
    setError(null)
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (form.password !== form.confirm) {
      setError("Passwords don't match.")
      return
    }
    setBusy(true)
    const res = await fetch(`/api/team/join/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        legal_name: form.legal_name,
        phone: form.phone,
        address: form.address,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        availability: form.availability,
        signature: form.signature || null,
        signature_type: "typed",
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.")
      return
    }
    setStep(TOTAL)
    setTimeout(() => {
      router.push("/team")
      router.refresh()
    }, 2400)
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto px-6">
      {step < TOTAL && (
        <div className="flex gap-1.5 pt-6">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-[#2D8C6F]" : "bg-[#242424]"}`} />
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center py-8">
        {/* 0 — Welcome */}
        {step === 0 && (
          <div className="text-center space-y-4">
            <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-20 w-auto mx-auto" />
            <h1 className="text-3xl font-bold">Welcome to the crew, {first}! 🎉</h1>
            <p className="text-gray-400">Quick setup — about 3 minutes. First, a little about who we are and what we&apos;re about.</p>
          </div>
        )}

        {/* 1 — Who we are (mission + values) */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Heart className="h-6 w-6 text-[#2D8C6F]" />
              <h2 className="text-2xl font-bold">Who we are</h2>
            </div>
            <p className="text-sm text-gray-300 bg-[#111111] border border-[#242424] rounded-xl p-4 leading-relaxed">{MISSION}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 pt-1">Our values</p>
            <div className="space-y-2.5">
              {VALUES.map((v, i) => (
                <div key={v.title} className="flex gap-3">
                  <span className="text-[#2D8C6F] font-bold shrink-0">{i + 1}.</span>
                  <div>
                    <p className="font-semibold leading-tight">{v.title}</p>
                    <p className="text-sm text-gray-400">{v.body}{v.scripture && <span className="text-[#2D8C6F]"> — {v.scripture}</span>}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2 — What's expected */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">What&apos;s expected</h2>
            <p className="text-sm text-gray-400 -mt-2">The everyday standards behind the values.</p>
            <ul className="space-y-2.5">
              {EXPECTATIONS.map((e) => (
                <li key={e} className="flex gap-3 text-sm text-gray-300">
                  <Check className="h-4 w-4 text-[#2D8C6F] shrink-0 mt-0.5" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3 — Contact */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Your info</h2>
            <p className="text-sm text-gray-400 -mt-2">Make sure this is right — it&apos;s how we reach you and set up your pay.</p>
            <Labeled label="Legal full name (for payroll)">
              <input className={inputCls} value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} placeholder="As it appears on your ID" />
            </Labeled>
            <Labeled label="Email (your login)">
              <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" inputMode="email" />
            </Labeled>
            <Labeled label="Phone">
              <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="704-555-0123" inputMode="tel" />
            </Labeled>
            <Labeled label="Home address">
              <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, City" />
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Emergency contact">
                <input className={inputCls} value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} placeholder="Name" />
              </Labeled>
              <Labeled label="Their phone">
                <input className={inputCls} value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} placeholder="Phone" inputMode="tel" />
              </Labeled>
            </div>
          </div>
        )}

        {/* 4 — Availability */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">When can you work?</h2>
            <p className="text-sm text-gray-400 -mt-2">Tap the days you&apos;re usually available. You can change this later.</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const on = !!form.availability[d.key]
                return (
                  <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${on ? "bg-[#2D8C6F] text-white border-[#2D8C6F]" : "bg-[#111111] border-[#242424] text-gray-400"}`}>
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 5 — Agreement */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-[#2D8C6F]" /> The agreement</h2>
            <div className="rounded-xl bg-[#111111] border border-[#242424] p-4 text-sm text-gray-300 leading-relaxed max-h-52 overflow-y-auto">
              {AGREEMENT}
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.agreed} onChange={(e) => setForm({ ...form, agreed: e.target.checked })}
                className="mt-1 h-5 w-5 accent-[#2D8C6F]" />
              <span className="text-sm text-gray-300">I&apos;ve read and agree to the above.</span>
            </label>
            <Labeled label="Sign by typing your full name">
              <input className={`${inputCls} font-serif text-lg`} value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} placeholder="Your full name" />
            </Labeled>
          </div>
        )}

        {/* 6 — Password */}
        {step === 6 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Set your password</h2>
            <p className="text-sm text-gray-400 -mt-2">You&apos;ll log in with your email and this password.</p>
            <input className={inputCls} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (8+ characters)" autoComplete="new-password" />
            <input className={inputCls} type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Confirm password" autoComplete="new-password" />
          </div>
        )}

        {/* 7 — Done */}
        {step === TOTAL && (
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-[#2D8C6F]/15 flex items-center justify-center">
              <Check className="h-9 w-9 text-[#2D8C6F]" />
            </div>
            <h1 className="text-3xl font-bold">You&apos;re in! 🧭</h1>
            <p className="text-gray-400">A couple setup steps are waiting for you inside — including your Gusto onboarding so you get paid.</p>
            <p className="text-xs text-gray-600">Taking you to your portal…</p>
          </div>
        )}

        {error && step < TOTAL && <p className="text-sm text-red-400 mt-4">{error}</p>}
      </div>

      {step < TOTAL && (
        <div className="pb-8">
          {step < 6 ? (
            <button onClick={next} className="w-full rounded-xl bg-[#2D8C6F] py-4 font-semibold text-white hover:bg-[#1F6B54] flex items-center justify-center gap-2">
              {step === 0 ? "Let's go" : "Continue"} <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={finish} disabled={busy} className="w-full rounded-xl bg-[#2D8C6F] py-4 font-semibold text-white hover:bg-[#1F6B54] disabled:opacity-60">
              {busy ? "Setting up…" : "Finish setup"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}
