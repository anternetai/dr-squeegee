"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BRAND, CLUB_NAME, FONTS } from "@/lib/squeegee/brand"

interface Props {
  next: string | null
}

export function LoginForm({ next }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "forgot">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [infoMsg, setInfoMsg] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch("/api/portal/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!res.ok) {
        setErrorMsg(json.error || "Sign-in failed. Please try again.")
        return
      }
      router.push(next ? `/portal/${next}` : "/portal")
      router.refresh()
    } catch {
      setErrorMsg("Network error — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch("/api/portal/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      setInfoMsg(json.message || "If that email has an account, we've sent a sign-in link.")
    } catch {
      setErrorMsg("Network error — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls =
    "w-full px-4 py-3.5 rounded-xl bg-[#111111] border border-[#242424] text-white text-base placeholder:text-white/25 focus:outline-none focus:border-[#2D8C6F]"

  return (
    <div
      className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4 py-10"
      style={{ fontFamily: FONTS.body }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/images/squeegee/logo-badge.png"
            alt="Dr. Squeegee"
            className="h-16 w-auto mx-auto mb-4"
          />
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#2D8C6F]">
            {CLUB_NAME}
          </p>
          <h1 className="text-2xl font-bold text-white mt-1" style={{ fontFamily: FONTS.display }}>
            {mode === "login" ? "Member Sign-In" : "Get a sign-in link"}
          </h1>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className={inputCls}
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className={inputCls}
            />
            {errorMsg && <p className="text-sm text-[#E87B6F]">{errorMsg}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] text-white font-bold text-base transition-colors disabled:opacity-50"
              style={{ fontFamily: FONTS.display }}
            >
              {submitting ? "SIGNING IN..." : "SIGN IN"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("forgot")
                setErrorMsg(null)
              }}
              className="w-full text-center text-sm text-white/40 hover:text-white/70 transition-colors pt-1"
            >
              Forgot password?
            </button>
          </form>
        ) : infoMsg ? (
          <div className="text-center">
            <p className="text-3xl mb-3">&#128236;</p>
            <p className="text-white/80 text-sm leading-relaxed">{infoMsg}</p>
            <button
              onClick={() => {
                setMode("login")
                setInfoMsg(null)
              }}
              className="mt-6 text-sm text-[#2D8C6F] hover:underline"
            >
              &larr; Back to sign-in
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgot} className="space-y-3">
            <p className="text-sm text-white/50 leading-relaxed">
              Enter your email and we&apos;ll send you a one-tap sign-in link — no password
              needed.
            </p>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className={inputCls}
            />
            {errorMsg && <p className="text-sm text-[#E87B6F]">{errorMsg}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-14 rounded-xl bg-[#2D8C6F] hover:bg-[#1F6B54] text-white font-bold text-base transition-colors disabled:opacity-50"
              style={{ fontFamily: FONTS.display }}
            >
              {submitting ? "SENDING..." : "EMAIL MY SIGN-IN LINK"}
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="w-full text-center text-sm text-white/40 hover:text-white/70 transition-colors pt-1"
            >
              &larr; Back to sign-in
            </button>
          </form>
        )}

        <p className="text-center text-xs text-white/25 mt-10" style={{ fontFamily: FONTS.display }}>
          {BRAND.name} &middot; {BRAND.tagline}
        </p>
      </div>
    </div>
  )
}
