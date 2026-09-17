"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, RotateCcw, Trash2, X } from "lucide-react"
import { missingServices } from "@/lib/squeegee/crew"
import { captureFrame, compress, localKey } from "./photo-utils"
import type { JobPhoto } from "./job-view"

/**
 * The camera that STAYS OPEN.
 *
 * The v2 flow was one file-input per tap: shoot, sheet closes, find the Add
 * button again, shoot. Anthony's walk-through killed it. Here the shutter never
 * dismisses anything — you shoot a service until it's covered, move to the next
 * one, and the sheet only asks "need to add any more?" once you've been through
 * them all. Every shot uploads in the background against a per-service `service`
 * so the server-side gate can tell a windows photo from a driveway photo.
 */

type Kind = "before" | "after"

interface Shot {
  localId: string
  localUrl: string
  service: string
  blob: Blob
  state: "uploading" | "failed"
  error?: string
}

export function CameraSheet({
  jobId,
  kind,
  services,
  photos,
  startService,
  onAdded,
  onRemoved,
  onClose,
}: {
  jobId: string
  kind: Kind
  services: string[]
  photos: JobPhoto[]
  startService?: string
  onAdded: (photo: JobPhoto) => void
  onRemoved: (id: string) => void
  onClose: () => void
}) {
  const startIndex = Math.max(0, startService ? services.indexOf(startService) : 0)
  const [index, setIndex] = useState(startIndex)
  const [shots, setShots] = useState<Shot[]>([])
  const [askMore, setAskMore] = useState(false)
  const [mode, setMode] = useState<"camera" | "fallback">("camera")
  const [ready, setReady] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pendingRef = useRef<Shot[]>([])
  const pumpingRef = useRef(false)
  const urlsRef = useRef<string[]>([])

  const service = services[index] ?? services[0] ?? "Job"
  const label = kind === "before" ? "Before" : "After"
  const missing = missingServices(kind, services, photos)
  const uploading = shots.filter((s) => s.state === "uploading").length

  // ---- live camera ----
  //
  // iOS home-screen PWAs do support getUserMedia (14.3+), but a denied permission,
  // a laptop with no rear camera and a non-HTTPS origin all land here too. Any of
  // them switches the whole sheet to the OS camera via a file input — same chips,
  // same queue, same prompts, so the crew never sees a dead end.
  useEffect(() => {
    if (mode !== "camera") return
    let cancelled = false
    let stream: MediaStream | null = null

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setMode("fallback")
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1600 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => {})
          setReady(true)
        }
      } catch {
        if (!cancelled) setMode("fallback")
      }
    }
    void start()

    return () => {
      cancelled = true
      setReady(false)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [mode])

  // Blob URLs outlive the component unless we say otherwise.
  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [])

  // ---- upload queue: one at a time, never lose a shot silently ----
  const send = useCallback(
    async (shot: Shot) => {
      try {
        const form = new FormData()
        form.append("file", new File([shot.blob], "photo.jpg", { type: "image/jpeg" }))
        form.append("kind", kind)
        form.append("service", shot.service)
        const res = await fetch(`/api/team/jobs/${jobId}/photos`, { method: "POST", body: form })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          photo?: { id: string; kind: Kind; service?: string | null; url: string | null }
        }
        if (!res.ok || !data.photo) throw new Error(data.error ?? "Upload failed.")
        // Hand it to the job screen, then drop the local copy so the thumbnail
        // doesn't appear twice.
        onAdded({
          id: data.photo.id,
          kind,
          service: data.photo.service ?? shot.service,
          url: data.photo.url ?? shot.localUrl,
        })
        setShots((prev) => prev.filter((s) => s.localId !== shot.localId))
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed."
        setShots((prev) =>
          prev.map((s) => (s.localId === shot.localId ? { ...s, state: "failed", error: message } : s))
        )
      }
    },
    [jobId, kind, onAdded]
  )

  const pump = useCallback(async () => {
    if (pumpingRef.current) return
    pumpingRef.current = true
    try {
      while (pendingRef.current.length > 0) {
        const next = pendingRef.current.shift()
        if (next) await send(next)
      }
    } finally {
      pumpingRef.current = false
    }
  }, [send])

  const enqueue = useCallback(
    (blob: Blob, forService: string) => {
      const localUrl = URL.createObjectURL(blob)
      urlsRef.current.push(localUrl)
      const shot: Shot = {
        localId: localKey(),
        localUrl,
        service: forService,
        blob,
        state: "uploading",
      }
      setShots((prev) => [...prev, shot])
      pendingRef.current.push(shot)
      void pump()
    },
    [pump]
  )

  function retry(localId: string) {
    const shot = shots.find((s) => s.localId === localId)
    if (!shot) return
    setShots((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, state: "uploading", error: undefined } : s))
    )
    pendingRef.current.push({ ...shot, state: "uploading" })
    void pump()
  }

  function discard(localId: string) {
    setShots((prev) => prev.filter((s) => s.localId !== localId))
  }

  async function shoot() {
    const video = videoRef.current
    if (!video) return
    try {
      enqueue(await captureFrame(video), service)
    } catch {
      setMode("fallback")
    }
  }

  async function pickFiles(files: FileList | null) {
    if (!files) return
    for (const file of Array.from(files)) {
      try {
        enqueue(await compress(file), service)
      } catch {
        // A single unreadable file shouldn't kill the rest of the batch.
      }
    }
    if (fileRef.current) fileRef.current.value = ""
  }

  async function removeSaved(id: string) {
    const res = await fetch(`/api/team/photos/${id}`, { method: "DELETE" })
    if (res.ok) onRemoved(id)
  }

  const covered = useCallback(
    (s: string) => !missing.includes(s),
    [missing]
  )

  // Thumbnails for the service being shot: saved photos first, then anything
  // still in flight or stuck.
  const strip = useMemo(() => {
    const saved = photos.filter(
      (p) => p.kind === kind && (p.service ?? "").toLowerCase() === service.toLowerCase()
    )
    const wild = photos.filter((p) => p.kind === kind && p.service == null)
    return { saved, wild, local: shots.filter((s) => s.service === service) }
  }, [photos, shots, kind, service])

  const isLast = index >= services.length - 1

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Header: what you're shooting, and how far through the job you are. */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4FC49E]">
            {label} photos
          </p>
          <h2 className="text-xl font-bold leading-tight truncate">{service}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {label} · {service} · {index + 1} of {services.length} service
            {services.length === 1 ? "" : "s"}
            {uploading > 0 && <span className="text-[#E0A458]"> · Saving {uploading}…</span>}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close camera"
          className="-mr-2 -mt-1 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Service chips: a check means that one is covered. Tap to jump. */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        {services.map((s, i) => {
          const done = covered(s)
          const active = i === index
          return (
            <button
              key={s}
              onClick={() => {
                setIndex(i)
                setAskMore(false)
              }}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                active
                  ? "border-[#2D8C6F] bg-[#2D8C6F]/20 text-white"
                  : done
                    ? "border-[#2D8C6F]/40 bg-[#2D8C6F]/[0.08] text-[#4FC49E]"
                    : "border-[#242424] bg-[#111111] text-gray-300"
              }`}
            >
              {done && <Check className="h-3.5 w-3.5" />}
              {s}
            </button>
          )
        })}
      </div>

      {/* Viewfinder, or the plain-words fallback. */}
      <div className="relative flex-1 min-h-0 bg-[#080808]">
        {mode === "camera" ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
            />
            {!ready && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
                Starting camera…
              </p>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-sm text-gray-400">
              Camera not available here - use your phone&apos;s camera
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-[#2D8C6F]/60 bg-[#2D8C6F]/[0.08] px-5 py-3 text-sm font-semibold text-[#4FC49E]"
            >
              Take {label.toLowerCase()} photos of the {service}
            </button>
          </div>
        )}
      </div>

      {/* What's been shot for THIS service. */}
      {(strip.saved.length > 0 || strip.wild.length > 0 || strip.local.length > 0) && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {[...strip.saved, ...strip.wild].map((p) => (
            <div key={p.id} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url ?? ""}
                alt={`${kind} photo of ${p.service ?? service}`}
                className="h-20 w-20 rounded-xl border border-[#242424] object-cover"
              />
              <button
                onClick={() => removeSaved(p.id)}
                aria-label="Remove photo"
                className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-[#242424] bg-[#0A0A0A] text-gray-400 hover:text-[#E5776B]"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {strip.local.map((s) => (
            <div key={s.localId} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.localUrl}
                alt={`${kind} photo of ${s.service}`}
                className={`h-20 w-20 rounded-xl border object-cover ${
                  s.state === "failed" ? "border-[#E5776B] opacity-70" : "border-[#242424] opacity-60"
                }`}
              />
              {s.state === "uploading" ? (
                <span className="absolute inset-x-0 bottom-0 rounded-b-xl bg-black/70 py-0.5 text-center text-[10px] text-gray-300">
                  Saving…
                </span>
              ) : (
                <>
                  <button
                    onClick={() => retry(s.localId)}
                    className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-b-xl bg-[#E5776B] py-0.5 text-[10px] font-semibold text-white"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Retry
                  </button>
                  <button
                    onClick={() => discard(s.localId)}
                    aria-label="Discard photo"
                    className="absolute -top-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-[#242424] bg-[#0A0A0A] text-gray-400 hover:text-[#E5776B]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Controls. The shutter never closes anything. */}
      <div className="border-t border-[#1A1A1A] bg-[#0A0A0A] px-4 pb-6 pt-3">
        {askMore ? (
          <div>
            <p className="text-center text-lg font-bold">Need to add any more?</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setAskMore(false)}
                className="flex-1 rounded-xl border border-[#242424] bg-[#111111] py-4 text-base font-semibold text-gray-200"
              >
                Add more
              </button>
              {missing.length > 0 ? (
                <button
                  disabled
                  className="flex-1 rounded-xl bg-[#1A1A1A] py-4 text-sm font-semibold text-[#E0A458]"
                >
                  Still need: {missing.join(", ")}
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-[#2D8C6F] py-4 text-base font-semibold text-white hover:bg-[#1F6B54]"
                >
                  I&apos;m done
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={() => (mode === "camera" ? shoot() : fileRef.current?.click())}
              disabled={mode === "camera" && !ready}
              aria-label={`Take a ${kind} photo of the ${service}`}
              className="h-[72px] w-[72px] shrink-0 rounded-full border-4 border-white/80 bg-white/10 active:bg-white/30 disabled:opacity-40"
            >
              <span className="mx-auto block h-14 w-14 rounded-full bg-white" />
            </button>
            <button
              onClick={() => (isLast ? setAskMore(true) : setIndex((i) => i + 1))}
              className="flex-1 rounded-xl border border-[#242424] bg-[#111111] py-4 text-base font-semibold text-gray-200 hover:border-[#2D8C6F]"
            >
              {isLast ? `Done with ${service}` : "Next service →"}
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => pickFiles(e.target.files)}
        className="hidden"
      />
    </div>
  )
}
