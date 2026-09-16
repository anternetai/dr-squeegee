"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, KeyRound } from "lucide-react"

const inputCls =
  "w-full rounded-xl bg-[#111111] border border-[#242424] px-4 py-3 text-white outline-none focus:border-[#2D8C6F] placeholder:text-gray-600"

// The short form of onboarding: the crew member is already set up (agreement
// signed, info on file) and only needs a PIN — because they joined under the old
// email+password portal, or Anthony reset the one they forgot. One screen, no
// re-signing anything.
export function CrewSetPin({ token, name }: { token: string; name: string }) {
  const router = useRouter()
  const [pin, setPin] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const first = name.trim().split(/\s+/)[0] || "there"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\d{4}$/.test(pin)) {
      setError("Your PIN must be 4 digits.")
      return
    }
    if (pin !== confirm) {
      setError("Those PINs don't match.")
      return
    }
    setBusy(true)
    const res = await fetch(`/api/team/join/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.")
      return
    }
    setDone(true)
    setTimeout(() => {
      router.push("/team")
      router.refresh()
    }, 1600)
  }

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-[#2D8C6F]/15 flex items-center justify-center">
          <Check className="h-9 w-9 text-[#2D8C6F]" />
        </div>
        <h1 className="text-2xl font-bold mt-4">PIN set. You&apos;re in.</h1>
        <p className="text-xs text-gray-600 mt-2">Taking you to your jobs…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto px-6 justify-center">
      <form onSubmit={submit} className="space-y-5 py-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-[#2D8C6F]" />
            <h1 className="text-2xl font-bold">Pick a 4-digit PIN, {first}</h1>
          </div>
          <p className="text-sm text-gray-400">
            You&apos;ll log in with your phone number and this PIN. Pick something you&apos;ll remember - not 1234.
          </p>
        </div>
        <input
          className={inputCls}
          type="tel"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="4-digit PIN"
          autoComplete="off"
          autoFocus
        />
        <input
          className={inputCls}
          type="tel"
          inputMode="numeric"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Confirm PIN"
          autoComplete="off"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || pin.length !== 4 || confirm.length !== 4}
          className="w-full rounded-xl bg-[#2D8C6F] py-4 font-semibold text-white hover:bg-[#1F6B54] disabled:opacity-40 disabled:hover:bg-[#2D8C6F]"
        >
          {busy ? "Saving…" : "Save PIN"}
        </button>
      </form>
    </div>
  )
}
