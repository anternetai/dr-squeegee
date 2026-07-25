"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function CrewLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await fetch("/api/team/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? "Login failed.")
      return
    }
    router.push("/team")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/images/squeegee/logo-badge.png" alt="Dr. Squeegee" className="h-28 w-auto mx-auto mb-4" />
          <p className="text-xs uppercase tracking-widest text-[#2D8C6F] font-semibold">Crew Portal</p>
          <h1 className="text-2xl font-bold mt-1">Log in</h1>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-xl bg-[#111111] border border-[#242424] px-4 py-3 text-white outline-none focus:border-[#2D8C6F]"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-xl bg-[#111111] border border-[#242424] px-4 py-3 text-white outline-none focus:border-[#2D8C6F]"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#2D8C6F] py-3 font-semibold text-white hover:bg-[#1F6B54] disabled:opacity-60"
          >
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="text-center text-xs text-gray-500 mt-6">
          New to the crew? Use the setup link Anthony texted you.
        </p>
      </div>
    </div>
  )
}
