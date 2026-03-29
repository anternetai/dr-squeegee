"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function CRMLogin() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await fetch("/api/crm/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      window.location.href = "/crm"
    } else {
      setError("Wrong password. Try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FEFCF7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <span
            className="text-2xl font-bold text-[#3A6B4C]"
            style={{ fontFamily: "var(--font-brand-display), serif" }}
          >
            Dr. Squeegee
          </span>
        </div>
        <form onSubmit={handleSubmit} className="bg-[#F5F0E1] rounded-xl p-6 border border-[#3A6B4C]/15 space-y-4">
          <h1
            className="text-lg font-semibold text-[#2B2B2B] text-center"
            style={{ fontFamily: "var(--font-brand-display), serif" }}
          >
            CRM Access
          </h1>
          <label htmlFor="crm-password" className="sr-only">Passphrase</label>
          <input
            id="crm-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passphrase"
            autoFocus
            aria-label="Enter passphrase to access CRM"
            className="w-full px-4 py-3 bg-white border border-[#3A6B4C]/15 rounded-lg text-[#2B2B2B] placeholder:text-[#2B2B2B]/30 focus:outline-none focus:border-[#3A6B4C]"
          />
          {error && <p className="text-sm text-[#B8453A]">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-[#3A6B4C] hover:bg-[#2F5A3F] disabled:bg-[#2B2B2B]/20 disabled:cursor-not-allowed text-[#F5F0E1] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Enter
          </button>
        </form>
      </div>
    </div>
  )
}
