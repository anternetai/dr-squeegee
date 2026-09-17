"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Download, Plus, Share, MoreVertical } from "lucide-react"

/**
 * "Install this app now."
 *
 * The quiet card on /team/me was getting ignored, and a crew member running this
 * in a browser tab gets NO job alerts — on iPhone push is literally impossible
 * until the site is on the home screen. So this is a bottom sheet on every /team
 * visit, and "Not now" only lasts the session. There is deliberately no permanent
 * dismiss: the nag ends when the app is installed, not when it's waved away.
 */

const DISMISS_KEY = "crew-install-dismissed"

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function InstallSheet() {
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [canPrompt, setCanPrompt] = useState(false)
  const [busy, setBusy] = useState(false)
  const promptRef = useRef<InstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone()) return
    // Private mode can throw on sessionStorage; a nag we can't suppress beats a
    // crash on the crew's home screen.
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return
    } catch {
      /* no session storage — show it */
    }
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    setShow(true)
  }, [])

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      promptRef.current = e as InstallPromptEvent
      setCanPrompt(true)
    }
    function onInstalled() {
      setShow(false)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function install() {
    const evt = promptRef.current
    if (!evt) return
    setBusy(true)
    try {
      await evt.prompt()
      const { outcome } = await evt.userChoice
      if (outcome === "accepted") setShow(false)
    } finally {
      setBusy(false)
      promptRef.current = null
      setCanPrompt(false)
    }
  }

  function notNow() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1")
    } catch {
      /* it comes back next open either way */
    }
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button aria-label="Close" onClick={notNow} className="absolute inset-0 bg-black/70" />
      <div className="relative w-full rounded-t-3xl border-t border-[#E0A458]/40 bg-[#111111] px-5 pb-8 pt-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#242424]" />
        <h2 className="text-2xl font-bold leading-tight">Install this app now</h2>
        <p className="mt-1.5 text-[15px] text-[#E0A458]">
          Job alerts don&apos;t work in the browser. It takes 10 seconds.
        </p>

        {isIos ? (
          <ol className="mt-5 space-y-3">
            <Step n={1} icon={<Share className="h-6 w-6" />} text="Tap the Share button" />
            <Step n={2} icon={<Plus className="h-6 w-6" />} text="Tap “Add to Home Screen”" />
            <Step n={3} icon={<Check className="h-6 w-6" />} text="Open it from your home screen" />
          </ol>
        ) : canPrompt ? (
          <button
            onClick={install}
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2D8C6F] py-4 text-lg font-semibold text-white hover:bg-[#1F6B54] disabled:opacity-60"
          >
            <Download className="h-5 w-5" />
            {busy ? "Installing…" : "Install"}
          </button>
        ) : (
          <ol className="mt-5 space-y-3">
            <Step n={1} icon={<MoreVertical className="h-6 w-6" />} text="Tap the ⋮ menu" />
            <Step n={2} icon={<Plus className="h-6 w-6" />} text="Tap “Add to Home screen”" />
            <Step n={3} icon={<Check className="h-6 w-6" />} text="Open it from your home screen" />
          </ol>
        )}

        <button onClick={notNow} className="mt-4 w-full py-3 text-sm font-medium text-gray-500">
          Not now
        </button>
      </div>
    </div>
  )
}

function Step({ n, icon, text }: { n: number; icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2D8C6F]/15 text-base font-bold text-[#4FC49E]">
        {n}
      </span>
      <span className="text-gray-400">{icon}</span>
      <span className="text-[15px] font-medium text-gray-200">{text}</span>
    </li>
  )
}
