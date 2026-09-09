"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Bell, BellRing, Check, LogOut, Share, Plus } from "lucide-react"
import { formatDuration, hoursFrom, money } from "@/lib/squeegee/crew"

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function MeView({
  name,
  payType,
  workedMs,
  driveMs,
  jobsDone,
  pay,
  pushRegistered,
  vapidPublicKey,
}: {
  name: string
  payType: string
  workedMs: number
  driveMs: number
  jobsDone: number
  pay: number | null
  pushRegistered: boolean
  vapidPublicKey: string | null
}) {
  const router = useRouter()
  const first = name.trim().split(/\s+/)[0]

  async function logout() {
    await fetch("/api/team/auth/logout", { method: "POST" })
    router.push("/team/login")
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-16">
      <header className="flex items-center gap-2 py-4">
        <Link
          href="/team"
          className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">{first}&apos;s week</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="On site" value={formatDuration(workedMs)} qualifier={`${hoursFrom(workedMs)} hrs`} />
        <Tile label="Driving" value={formatDuration(driveMs)} qualifier={`${hoursFrom(driveMs)} hrs`} />
      </div>

      <div className="mt-3 rounded-2xl border border-[#242424] bg-[#111111] p-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">
          {payType === "hourly" ? "Earned this week" : payType === "per_job" ? "Job pay this week" : "This week"}
        </p>
        <p className="mt-1 text-3xl font-bold">
          {pay == null ? "—" : money(pay)}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {pay == null
            ? "Anthony settles your pay directly."
            : `${jobsDone} job${jobsDone === 1 ? "" : "s"} finished`}
        </p>
      </div>

      <PushCard registered={pushRegistered} vapidPublicKey={vapidPublicKey} />

      <div className="mt-6 space-y-1">
        <Link
          href="/team/standards"
          className="block rounded-xl border border-[#242424] bg-[#111111] px-4 py-3.5 text-sm font-medium hover:border-[#2D8C6F]/40"
        >
          Our standards
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 rounded-xl border border-[#242424] px-4 py-3.5 text-sm font-medium text-gray-400 hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </div>
  )
}

function Tile({ label, value, qualifier }: { label: string; value: string; qualifier: string }) {
  return (
    <div className="rounded-2xl border border-[#242424] bg-[#111111] p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs text-gray-500">{qualifier}</p>
    </div>
  )
}

/**
 * Push setup.
 *
 * iOS is the reason this is a whole card and not a toggle: Safari delivers NOTHING
 * until the site is added to the home screen, and the server can't detect that.
 * So we detect standalone mode here and walk them through it rather than letting
 * them believe notifications are on when they silently aren't.
 */
function PushCard({
  registered,
  vapidPublicKey,
}: {
  registered: boolean
  vapidPublicKey: string | null
}) {
  const [state, setState] = useState<"unknown" | "on" | "off" | "blocked" | "unsupported">("unknown")
  const [standalone, setStandalone] = useState(true)
  const [isIos, setIsIos] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIos(ios)
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    )
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported")
      return
    }
    if (Notification.permission === "denied") setState("blocked")
    else if (Notification.permission === "granted" && registered) setState("on")
    else setState("off")
  }, [registered])

  async function enable() {
    setBusy(true)
    setError(null)
    try {
      if (!vapidPublicKey) throw new Error("Push isn't configured yet - tell Anthony.")
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off")
        return
      }
      const reg = await navigator.serviceWorker.register("/team-sw.js", { scope: "/team" })
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      })
      const res = await fetch("/api/team/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error("Could not save it. Try again.")
      setState("on")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not turn on notifications.")
    } finally {
      setBusy(false)
    }
  }

  if (state === "unknown") return null

  // iOS, not installed: push literally cannot work yet. Say so plainly.
  if (isIos && !standalone) {
    return (
      <div className="mt-3 rounded-2xl border border-[#E0A458]/40 bg-[#E0A458]/[0.06] p-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#E0A458]" /> Add this to your home screen
        </h2>
        <p className="mt-1.5 text-sm text-gray-300">
          On iPhone, job alerts only work once this is installed. Takes 10 seconds:
        </p>
        <ol className="mt-2.5 space-y-1.5 text-sm text-gray-300">
          <li className="flex items-center gap-2">
            <Share className="h-4 w-4 text-gray-500 shrink-0" /> 1. Tap the Share button
          </li>
          <li className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-gray-500 shrink-0" /> 2. Tap &ldquo;Add to Home Screen&rdquo;
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 text-gray-500 shrink-0" /> 3. Open it from your home screen
          </li>
        </ol>
      </div>
    )
  }

  if (state === "on") {
    return (
      <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-[#2D8C6F]/40 bg-[#2D8C6F]/[0.06] px-4 py-3.5">
        <BellRing className="h-4 w-4 text-[#4FC49E]" />
        <span className="text-sm font-medium text-[#4FC49E]">Job alerts are on</span>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-2xl border border-[#242424] bg-[#111111] p-4">
      <h2 className="font-semibold flex items-center gap-2">
        <Bell className="h-4 w-4 text-gray-400" /> Job alerts
      </h2>
      <p className="mt-1 text-sm text-gray-400">
        {state === "blocked"
          ? "Notifications are blocked in your phone's settings for this site. Turn them back on there, then come back."
          : state === "unsupported"
            ? "This phone's browser can't do alerts. Check the board when you start your day."
            : "Get a heads-up when a new job hits the board or your schedule changes."}
      </p>
      {state === "off" && (
        <button
          onClick={enable}
          disabled={busy}
          className="mt-3 w-full rounded-xl bg-[#2D8C6F] py-3 text-sm font-semibold text-white hover:bg-[#1F6B54] disabled:opacity-60"
        >
          {busy ? "Turning on…" : "Turn on alerts"}
        </button>
      )}
      {error && (
        <p className="mt-2 text-xs text-[#E5776B]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
