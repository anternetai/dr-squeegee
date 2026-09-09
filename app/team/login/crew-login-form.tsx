"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"

const PIN_LENGTH = 4

function formatPhone(digits: string): string {
  const d = digits.slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

export function CrewLoginForm() {
  const router = useRouter()
  const [phone, setPhone] = useState("")
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pinRef = useRef<HTMLInputElement>(null)

  const ready = phone.length === 10 && pin.length === PIN_LENGTH

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    const res = await fetch("/api/team/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, pin }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? "Login failed.")
      setPin("")
      pinRef.current?.focus()
      return
    }
    router.push("/team")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/squeegee/logo-badge.png"
            alt="Dr. Squeegee"
            className="h-28 w-auto mx-auto mb-4"
          />
          <p className="text-xs uppercase tracking-widest text-[#2D8C6F] font-semibold">
            Crew Portal
          </p>
          <h1 className="text-2xl font-bold mt-1">Log in</h1>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="crew-phone" className="block text-sm text-gray-400 mb-1.5">
              Your phone number
            </label>
            <input
              id="crew-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={formatPhone(phone)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 10)
                setPhone(digits)
                if (digits.length === 10 && pin.length === 0) pinRef.current?.focus()
              }}
              placeholder="(704) 555-0123"
              className="w-full rounded-xl bg-[#111111] border border-[#242424] px-4 py-3.5 text-lg text-white outline-none focus:border-[#2D8C6F]"
            />
          </div>

          <div>
            <label htmlFor="crew-pin" className="block text-sm text-gray-400 mb-1.5">
              Your 4-digit PIN
            </label>
            {/* One real input behind four boxes: the keyboard and autofill behave,
                and the crew still sees where they are. */}
            <div className="relative">
              <input
                id="crew-pin"
                ref={pinRef}
                type="tel"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
                className="absolute inset-0 w-full h-full opacity-0 z-10 text-transparent"
                aria-label="4-digit PIN"
              />
              <div className="grid grid-cols-4 gap-2.5" aria-hidden="true">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-14 rounded-xl border flex items-center justify-center text-2xl font-semibold ${
                      pin.length === i
                        ? "border-[#2D8C6F] bg-[#2D8C6F]/[0.08]"
                        : "border-[#242424] bg-[#111111]"
                    }`}
                  >
                    {pin[i] ? "•" : ""}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-[#E5776B]" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!ready || busy}
            className="w-full rounded-xl bg-[#2D8C6F] py-3.5 font-semibold text-white hover:bg-[#1F6B54] disabled:opacity-40 disabled:hover:bg-[#2D8C6F]"
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
