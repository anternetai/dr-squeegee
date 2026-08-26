"use client"

import { useState } from "react"
import { Star, MessageSquareWarning, Loader2, Check, Phone } from "lucide-react"
import { BRAND, FONTS } from "@/lib/squeegee/brand"

const TEAL = "#2D8C6F"

// Both doors are shown to every customer, always. No rating gate decides who
// gets to see the Google button — Google's policy prohibits selectively
// soliciting positive reviews, and the FTC's Consumer Reviews rule covers
// review suppression. Someone with a complaint takes the second door because
// that is where it gets fixed, not because the software withheld the first.
export function ReviewClient({ googleUrl }: { googleUrl: string }) {
  const [mode, setMode] = useState<"choose" | "feedback" | "done">("choose")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", phone: "", message: "" })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.message.trim()) {
      setError("Tell us what happened so we can make it right.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/squeegee/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please call us.")
        setBusy(false)
        return
      }
      setMode("done")
    } catch {
      setError("Network error. Please call us at " + BRAND.phone + ".")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4" style={{ fontFamily: FONTS.body }}>
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <img src="/images/squeegee/logo-badge.png" alt={BRAND.name} className="h-24 w-auto mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{BRAND.tagline}</p>
        </div>

        {mode === "done" ? (
          <div className="rounded-2xl border bg-card p-8 text-center" style={{ borderColor: `${TEAL}33` }}>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: `${TEAL}1A` }}
            >
              <Check className="h-7 w-7" style={{ color: TEAL }} />
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: FONTS.display }}>
              Thank you — we're on it.
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Anthony gets this straight to his phone and will reach out personally. If it's
              urgent, call or text{" "}
              <a href={`tel:${BRAND.phoneTel}`} className="font-semibold" style={{ color: TEAL }}>
                {BRAND.phone}
              </a>
              .
            </p>
          </div>
        ) : mode === "feedback" ? (
          <div className="rounded-2xl border bg-card p-6" style={{ borderColor: `${TEAL}33` }}>
            <h1 className="text-xl font-bold mb-1" style={{ fontFamily: FONTS.display }}>
              What went wrong?
            </h1>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              This goes straight to Anthony, not to a queue. We'd rather fix it than have you
              live with it.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Your name"
                autoComplete="name"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-[#2D8C6F]"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Phone (so we can call you back)"
                inputMode="tel"
                autoComplete="tel"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-[#2D8C6F]"
              />
              <textarea
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="Tell us what happened…"
                rows={5}
                autoFocus
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-[#2D8C6F] resize-none"
              />
              {error && <p className="text-sm text-[#B8453A]">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl px-5 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
                style={{ background: TEAL }}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Sending…" : "Send to Anthony"}
              </button>
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="w-full text-sm text-muted-foreground hover:text-foreground py-1"
              >
                Back
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-3xl font-bold" style={{ fontFamily: FONTS.display }}>
                How did we do?
              </h1>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                We're a small Charlotte crew. Thirty seconds of your time genuinely moves the
                needle for us.
              </p>
            </div>

            {/* Primary door. Offered to everyone, whatever they thought. */}
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl p-5 text-white transition-opacity hover:opacity-95"
              style={{ background: TEAL }}
            >
              <div className="flex items-center gap-4">
                <div className="shrink-0 w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
                  <Star className="h-5 w-5" fill="currentColor" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-base" style={{ fontFamily: FONTS.display }}>
                    Leave a Google review
                  </p>
                  <p className="text-sm text-white/80 leading-snug">
                    Opens Google — takes about 30 seconds.
                  </p>
                </div>
              </div>
            </a>

            {/* Second door. Same page, same prominence tier, no gate in front. */}
            <button
              type="button"
              onClick={() => setMode("feedback")}
              className="block w-full text-left rounded-2xl border bg-card p-5 transition-colors hover:border-[#2D8C6F]/50"
              style={{ borderColor: `${TEAL}33` }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: `${TEAL}1A` }}
                >
                  <MessageSquareWarning className="h-5 w-5" style={{ color: TEAL }} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-base" style={{ fontFamily: FONTS.display }}>
                    Something wasn't right
                  </p>
                  <p className="text-sm text-muted-foreground leading-snug">
                    Tell Anthony directly and he'll make it right.
                  </p>
                </div>
              </div>
            </button>

            <a
              href={`tel:${BRAND.phoneTel}`}
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground py-1"
            >
              <Phone className="h-3.5 w-3.5" />
              Or just call us — {BRAND.phone}
            </a>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground/70 pt-2">
          {BRAND.entity} · {BRAND.domain}
        </p>
      </div>
    </div>
  )
}
