"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  MapPin,
  MessageSquare,
  Phone,
  Trash2,
  Clock,
} from "lucide-react"
import {
  FIELD_STEPS,
  fieldStateSentence,
  formatDuration,
  nextStep,
  photoGateReason,
  type FieldStepKey,
} from "@/lib/squeegee/crew"
import { arrivalWindow } from "../../team-view"

export interface CrewJobDetail {
  id: string
  client_name: string
  client_phone: string | null
  address: string
  service_type: string
  notes: string | null
  status: string
  field_status: string | null
  appointment_date: string | null
  appointment_time: string | null
  completed_at: string | null
}

export interface JobPhoto {
  id: string
  kind: "before" | "after"
  url: string | null
}

const ETA_PRESETS = [5, 10, 15, 30, 45, 60]
const MAX_EDGE = 1600
const QUALITY = 0.8

/**
 * Shrink before upload. A raw phone photo is 3-4MB; this lands around 250KB.
 * Not an optimisation — at full size the storage tier is gone in a few months.
 */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("no canvas")
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not process that photo."))),
      "image/jpeg",
      QUALITY
    )
  })
}

export function JobView({
  job: initial,
  photos: initialPhotos,
  workedMs,
  driveMs,
  running,
}: {
  job: CrewJobDetail
  photos: JobPhoto[]
  workedMs: number
  driveMs: number
  running: boolean
}) {
  const router = useRouter()
  const [job, setJob] = useState(initial)
  const [photos, setPhotos] = useState(initialPhotos)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [askEta, setAskEta] = useState(false)
  const [note, setNote] = useState("")
  const [confirming, setConfirming] = useState(false)

  // Live-ticking work timer. Only counts while a segment is actually open.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!running || job.status === "complete") return
    const t = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [running, job.status])

  const step = nextStep(job)
  const counts = {
    before: photos.filter((p) => p.kind === "before").length,
    after: photos.filter((p) => p.kind === "after").length,
  }
  const gate = photoGateReason(counts)
  const sentence = fieldStateSentence(job)
  const phone = job.client_phone?.replace(/[^0-9]/g, "")
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(job.address)}`
  const liveWorkedMs = workedMs + (running && job.field_status === "in_progress" ? tick * 30_000 : 0)

  async function advance(to: FieldStepKey, etaMinutes?: number) {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/team/jobs/${job.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, etaMinutes }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    setAskEta(false)
    if (!res.ok) {
      setError(data.error ?? "Could not update.")
      router.refresh()
      return
    }
    setJob((j) => ({ ...j, field_status: to }))
    router.refresh()
  }

  async function markDone() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/team/jobs/${job.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note || null }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? "Could not mark done.")
      return
    }
    setJob((j) => ({ ...j, status: "complete", field_status: null }))
    setConfirming(false)
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24">
      <header className="flex items-center gap-2 py-4">
        <Link
          href="/team"
          className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight truncate">{job.client_name}</h1>
          <p className="text-sm text-[#2D8C6F] font-medium">{job.service_type}</p>
        </div>
      </header>

      {/* Where this job is right now — one sentence, only the verb emphasised. */}
      <p className="text-[15px] text-gray-300">
        {sentence.prefix}
        <span className="font-bold text-white">{sentence.verb}</span>
        {sentence.suffix}
      </p>

      <StepBar job={job} />

      {job.status !== "complete" && (
        <>
          <div className="mt-5 flex items-center gap-3">
            {phone && (
              <>
                <CircleAction href={`tel:${phone}`} label="Call">
                  <Phone className="h-5 w-5" />
                </CircleAction>
                <CircleAction href={`sms:${phone}`} label="Text">
                  <MessageSquare className="h-5 w-5" />
                </CircleAction>
              </>
            )}
            <CircleAction href={mapsUrl} label="Directions" external>
              <MapPin className="h-5 w-5" />
            </CircleAction>
            <div className="ml-auto text-right">
              <p className="text-xs text-gray-500">
                {arrivalWindow(job.appointment_time) ?? "No time set"}
              </p>
              {(liveWorkedMs > 0 || driveMs > 0) && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  {formatDuration(liveWorkedMs)} on site
                </p>
              )}
            </div>
          </div>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-start gap-2 text-sm text-gray-300"
          >
            <MapPin className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
            <span className="underline decoration-gray-600 underline-offset-2">{job.address}</span>
          </a>
        </>
      )}

      {job.notes && (
        <div className="mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
            Notes
          </h2>
          <p className="text-sm text-gray-300 bg-white/[0.03] rounded-xl px-3.5 py-3">{job.notes}</p>
        </div>
      )}

      <PhotoRail
        jobId={job.id}
        kind="before"
        photos={photos.filter((p) => p.kind === "before")}
        locked={job.status === "complete"}
        onAdd={(p) => setPhotos((prev) => [...prev, p])}
        onRemove={(pid) => setPhotos((prev) => prev.filter((x) => x.id !== pid))}
      />
      <PhotoRail
        jobId={job.id}
        kind="after"
        photos={photos.filter((p) => p.kind === "after")}
        locked={job.status === "complete"}
        onAdd={(p) => setPhotos((prev) => [...prev, p])}
        onRemove={(pid) => setPhotos((prev) => prev.filter((x) => x.id !== pid))}
      />

      {error && (
        <p className="mt-4 text-sm text-[#E5776B]" role="alert">
          {error}
        </p>
      )}

      {job.status === "complete" ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-[#2D8C6F]/40 bg-[#2D8C6F]/[0.06] py-4 text-[#4FC49E] font-semibold">
          <CheckCircle2 className="h-5 w-5" /> Job complete
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 border-t border-[#242424] bg-[#0A0A0A]/95 backdrop-blur px-4 py-3">
          <div className="mx-auto max-w-lg">
            {askEta ? (
              <div>
                <p className="text-sm text-gray-300 mb-2">How far out are you?</p>
                <div className="grid grid-cols-3 gap-2">
                  {ETA_PRESETS.map((m) => (
                    <button
                      key={m}
                      onClick={() => advance("on_my_way", m)}
                      disabled={busy}
                      className="rounded-xl border border-[#242424] bg-[#111111] py-3 font-semibold hover:border-[#2D8C6F] disabled:opacity-60"
                    >
                      {m} min
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setAskEta(false)}
                  className="mt-2 w-full py-2 text-sm text-gray-400"
                >
                  Cancel
                </button>
                <p className="mt-1 text-center text-xs text-gray-500">
                  We&apos;ll text {job.client_name.split(" ")[0]} that you&apos;re on the way.
                </p>
              </div>
            ) : confirming ? (
              <div className="space-y-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything Anthony should know? (optional)"
                  rows={2}
                  className="w-full rounded-xl bg-[#111111] border border-[#242424] px-3 py-2 text-sm text-white outline-none focus:border-[#2D8C6F]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="flex-1 rounded-xl border border-[#242424] py-3 text-sm font-medium text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={markDone}
                    disabled={busy}
                    className="flex-1 rounded-xl bg-[#2D8C6F] py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Confirm done"}
                  </button>
                </div>
              </div>
            ) : step === "complete" ? (
              <button
                onClick={() => setConfirming(true)}
                disabled={busy || !!gate}
                className="w-full rounded-xl bg-[#2D8C6F] py-4 text-base font-semibold text-white hover:bg-[#1F6B54] disabled:bg-[#1A1A1A] disabled:text-gray-500"
              >
                {/* The reason lives ON the button. A tech on a bright driveway will
                    never see a toast. */}
                {gate ?? "Done"}
              </button>
            ) : step ? (
              <button
                onClick={() => (step === "on_my_way" ? setAskEta(true) : advance(step))}
                disabled={busy}
                className="w-full rounded-xl bg-[#2D8C6F] py-4 text-base font-semibold text-white hover:bg-[#1F6B54] disabled:opacity-60"
              >
                {busy ? "…" : FIELD_STEPS.find((s) => s.key === step)?.label}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

/** Three segments, current one partially filled. Our lifecycle is exactly three. */
function StepBar({ job }: { job: CrewJobDetail }) {
  const reached = (key: string) => {
    if (job.status === "complete") return true
    if (key === "on_my_way") return !!job.field_status
    if (key === "in_progress") return job.field_status === "in_progress"
    return false
  }
  const current = nextStep(job)
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {FIELD_STEPS.map((s) => {
        const isDone = reached(s.key)
        const isCurrent = current === s.key
        return (
          <div key={s.key}>
            <div
              className={`h-1.5 rounded-full ${
                isDone ? "bg-[#2D8C6F]" : isCurrent ? "bg-[#2D8C6F]/35" : "bg-[#242424]"
              }`}
            />
            <p
              className={`mt-1.5 text-[11px] ${
                isDone ? "text-[#4FC49E]" : isCurrent ? "text-gray-300" : "text-gray-600"
              }`}
            >
              {s.done}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function CircleAction({
  href,
  label,
  external,
  children,
}: {
  href: string
  label: string
  external?: boolean
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      aria-label={label}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="h-11 w-11 rounded-full border border-[#242424] bg-[#111111] flex items-center justify-center text-gray-200 hover:border-[#2D8C6F] hover:text-white"
    >
      {children}
    </a>
  )
}

function PhotoRail({
  jobId,
  kind,
  photos,
  locked,
  onAdd,
  onRemove,
}: {
  jobId: string
  kind: "before" | "after"
  photos: JobPhoto[]
  locked: boolean
  onAdd: (p: JobPhoto) => void
  onRemove: (id: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    for (const file of Array.from(files)) {
      try {
        const blob = await compress(file)
        const form = new FormData()
        form.append("file", new File([blob], "photo.jpg", { type: "image/jpeg" }))
        form.append("kind", kind)
        const res = await fetch(`/api/team/jobs/${jobId}/photos`, { method: "POST", body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data.error ?? "Upload failed.")
          break
        }
        onAdd(data.photo as JobPhoto)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add that photo.")
        break
      }
    }
    setBusy(false)
    if (inputRef.current) inputRef.current.value = ""
  }

  async function remove(id: string) {
    const res = await fetch(`/api/team/photos/${id}`, { method: "DELETE" })
    if (res.ok) onRemove(id)
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {kind === "before" ? "Before" : "After"}
          {photos.length > 0 && <span className="text-gray-600"> · {photos.length}</span>}
        </h2>
        {!locked && photos.length === 0 && (
          <span className="text-[11px] text-[#E0A458]">Required</span>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((p) => (
          <div key={p.id} className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url ?? ""}
              alt={`${kind} photo`}
              className="h-24 w-24 rounded-xl object-cover border border-[#242424]"
            />
            {!locked && (
              <button
                onClick={() => remove(p.id)}
                aria-label="Remove photo"
                className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-[#0A0A0A] border border-[#242424] flex items-center justify-center text-gray-400 hover:text-[#E5776B]"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {!locked && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="h-24 w-24 shrink-0 rounded-xl border border-dashed border-[#2D8C6F]/50 bg-[#2D8C6F]/[0.05] flex flex-col items-center justify-center gap-1 text-[#2D8C6F] disabled:opacity-60"
          >
            <Camera className="h-6 w-6" />
            <span className="text-[11px] font-medium">{busy ? "Saving…" : "Add"}</span>
          </button>
        )}
      </div>

      {/* capture="environment" opens the rear camera straight from the page — no
          app install, works on iPhone and Android. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => upload(e.target.files)}
        className="hidden"
      />

      {error && (
        <p className="mt-1.5 text-xs text-[#E5776B]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
