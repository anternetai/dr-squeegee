"use client"

import { useEffect, useState } from "react"
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
  stepReached,
  type FieldStepKey,
} from "@/lib/squeegee/crew"
import { arrivalWindow } from "../../team-view"
import { CameraSheet } from "./camera-sheet"

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
  /** Which service this covers. null = taken before the rule existed (wildcard). */
  service: string | null
  url: string | null
}

const ETA_PRESETS = [5, 10, 15, 30, 45, 60]

/** Which camera is open, and which service it opened on. */
interface SheetState {
  kind: "before" | "after"
  service?: string
}

/** The "Did you take pictures?" modal: asking, or listing what's still missing. */
interface AskState {
  kind: "before" | "after"
  stage: "ask" | "missing"
}

export function JobView({
  job: initial,
  photos: initialPhotos,
  services,
  workedMs,
  driveMs,
  running,
}: {
  job: CrewJobDetail
  photos: JobPhoto[]
  services: string[]
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
  const [ask, setAsk] = useState<AskState | null>(null)
  const [sheet, setSheet] = useState<SheetState | null>(null)

  // Live-ticking work timer. Only counts while a segment is actually open.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!running || job.status === "complete") return
    const t = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [running, job.status])

  const step = nextStep(job)
  const beforeGate = photoGateReason("before", services, photos)
  const afterGate = photoGateReason("after", services, photos)
  const sentence = fieldStateSentence(job)
  const phone = job.client_phone?.replace(/[^0-9]/g, "")
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(job.address)}`
  const liveWorkedMs = workedMs + (running && job.field_status === "in_progress" ? tick * 30_000 : 0)
  const first = job.client_name.trim().split(/\s+/)[0]

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

  /**
   * "Yes, I took them" — believe them only as far as the photos do. With the gate
   * clear this is the tap that starts the job; without it the modal turns into the
   * shortest possible list of what's missing and one button to go shoot it.
   */
  function answeredYes() {
    if (!ask) return
    const gate = ask.kind === "before" ? beforeGate : afterGate
    if (gate) {
      setAsk({ ...ask, stage: "missing" })
      return
    }
    setAsk(null)
    if (ask.kind === "before") void advance("in_progress")
    else setConfirming(true)
  }

  function openCamera(kind: "before" | "after", service?: string) {
    setAsk(null)
    setSheet({ kind, service })
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
            {/* Only rendered when the server handed over a number — an employee
                who may not contact customers never gets one. */}
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
        kind="before"
        services={services}
        photos={photos}
        locked={job.status === "complete"}
        onOpen={(service) => openCamera("before", service)}
        onRemove={(pid) => setPhotos((prev) => prev.filter((x) => x.id !== pid))}
      />
      <PhotoRail
        kind="after"
        services={services}
        photos={photos}
        locked={job.status === "complete"}
        onOpen={(service) => openCamera("after", service)}
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
                  We&apos;ll text {first} that you&apos;re on the way.
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
              <PrimaryStep
                busy={busy}
                gate={afterGate}
                litLabel="Done — photos done ✓"
                onTap={() => setAsk({ kind: "after", stage: "ask" })}
              />
            ) : step === "in_progress" ? (
              <PrimaryStep
                busy={busy}
                gate={beforeGate}
                litLabel="Start job — photos done ✓"
                onTap={() => setAsk({ kind: "before", stage: "ask" })}
              />
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

      {ask && (
        <PhotoAskModal
          kind={ask.kind}
          stage={ask.stage}
          gate={ask.kind === "before" ? beforeGate : afterGate}
          onYes={answeredYes}
          onShoot={() => openCamera(ask.kind)}
          onClose={() => setAsk(null)}
        />
      )}

      {sheet && (
        <CameraSheet
          jobId={job.id}
          kind={sheet.kind}
          services={services}
          photos={photos}
          startService={sheet.service}
          onAdded={(p) => setPhotos((prev) => [...prev, p])}
          onRemoved={(pid) => setPhotos((prev) => prev.filter((x) => x.id !== pid))}
          onClose={() => {
            setSheet(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

/**
 * The one big button at the bottom, in two states. Unlit it carries the gate
 * reason as its label — a tech on a bright driveway will never see a toast — and
 * still taps through to the modal, which is the road to the camera. Lit it is
 * unmistakable: solid teal, pulsing ring, and the tick that says photos are done.
 */
function PrimaryStep({
  busy,
  gate,
  litLabel,
  onTap,
}: {
  busy: boolean
  gate: string | null
  litLabel: string
  onTap: () => void
}) {
  return (
    <button
      onClick={onTap}
      disabled={busy}
      className={
        gate
          ? "w-full rounded-xl border border-[#E0A458]/40 bg-[#1A1A1A] py-4 text-base font-semibold text-[#E0A458] disabled:opacity-60"
          : "w-full rounded-xl bg-[#2D8C6F] py-4 text-base font-semibold text-white ring-2 ring-[#2D8C6F]/60 ring-offset-2 ring-offset-[#0A0A0A] animate-pulse hover:bg-[#1F6B54] disabled:opacity-60"
      }
    >
      {busy ? "…" : (gate ?? litLabel)}
    </button>
  )
}

/** "Did you take BEFORE pictures?" Big type, two answers, no ceremony. */
function PhotoAskModal({
  kind,
  stage,
  gate,
  onYes,
  onShoot,
  onClose,
}: {
  kind: "before" | "after"
  stage: "ask" | "missing"
  gate: string | null
  onYes: () => void
  onShoot: () => void
  onClose: () => void
}) {
  const word = kind === "before" ? "BEFORE" : "AFTER"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div className="relative w-full max-w-sm rounded-2xl border border-[#242424] bg-[#111111] p-6 text-center">
        {stage === "ask" ? (
          <>
            <h2 className="text-2xl font-bold leading-snug">
              Did you take {word} pictures?
            </h2>
            <div className="mt-6 flex gap-3">
              <button
                onClick={onShoot}
                className="flex-1 rounded-xl border border-[#242424] bg-[#0A0A0A] py-4 text-lg font-semibold text-gray-200"
              >
                No
              </button>
              <button
                onClick={onYes}
                className="flex-1 rounded-xl bg-[#2D8C6F] py-4 text-lg font-semibold text-white hover:bg-[#1F6B54]"
              >
                Yes
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold leading-snug text-[#E0A458]">
              {gate ?? `Still need ${kind} photos`}
            </h2>
            <button
              onClick={onShoot}
              className="mt-6 w-full rounded-xl bg-[#2D8C6F] py-4 text-lg font-semibold text-white hover:bg-[#1F6B54]"
            >
              Take them now
            </button>
            <button onClick={onClose} className="mt-2 w-full py-2 text-sm text-gray-500">
              Not yet
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Four segments: on the way, arrived, working, complete. */
function StepBar({ job }: { job: CrewJobDetail }) {
  const current = nextStep(job)
  return (
    <div className="mt-4 grid grid-cols-4 gap-2">
      {FIELD_STEPS.map((s) => {
        const isDone = stepReached(job, s.key)
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

/**
 * Photos, grouped the way the gate thinks: one row per service. A crew member
 * looking at "Before · Windows — Required" knows exactly what's missing without
 * counting thumbnails. Legacy photos with no service get their own row and count
 * for everything, so an in-flight job can never be bricked by this change.
 */
function PhotoRail({
  kind,
  services,
  photos,
  locked,
  onOpen,
  onRemove,
}: {
  kind: "before" | "after"
  services: string[]
  photos: JobPhoto[]
  locked: boolean
  onOpen: (service: string) => void
  onRemove: (id: string) => void
}) {
  const ofKind = photos.filter((p) => p.kind === kind)
  const wildcards = ofKind.filter((p) => p.service == null)
  const label = kind === "before" ? "Before" : "After"

  async function remove(id: string) {
    const res = await fetch(`/api/team/photos/${id}`, { method: "DELETE" })
    if (res.ok) onRemove(id)
  }

  const groups = services.map((service) => ({
    service,
    photos: ofKind.filter((p) => (p.service ?? "").toLowerCase() === service.toLowerCase()),
  }))

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
        {ofKind.length > 0 && <span className="text-gray-600"> · {ofKind.length}</span>}
      </h2>

      <div className="space-y-4">
        {groups.map((g) => {
          const required = !locked && g.photos.length === 0 && wildcards.length === 0
          return (
            <div key={g.service}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-medium text-gray-300">
                  {label} · {g.service}
                </p>
                {required && <span className="text-[11px] text-[#E0A458]">Required</span>}
              </div>
              <Strip
                photos={g.photos}
                kind={kind}
                locked={locked}
                onAdd={() => onOpen(g.service)}
                onRemove={remove}
              />
            </div>
          )
        })}

        {wildcards.length > 0 && (
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-gray-300">{label} · Earlier photos</p>
            <Strip
              photos={wildcards}
              kind={kind}
              locked={locked}
              onAdd={null}
              onRemove={remove}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function Strip({
  photos,
  kind,
  locked,
  onAdd,
  onRemove,
}: {
  photos: JobPhoto[]
  kind: "before" | "after"
  locked: boolean
  onAdd: (() => void) | null
  onRemove: (id: string) => void
}) {
  return (
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
              onClick={() => onRemove(p.id)}
              aria-label="Remove photo"
              className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-[#0A0A0A] border border-[#242424] flex items-center justify-center text-gray-400 hover:text-[#E5776B]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}

      {!locked && onAdd && (
        <button
          onClick={onAdd}
          className="h-24 w-24 shrink-0 rounded-xl border border-dashed border-[#2D8C6F]/50 bg-[#2D8C6F]/[0.05] flex flex-col items-center justify-center gap-1 text-[#2D8C6F]"
        >
          <Camera className="h-6 w-6" />
          <span className="text-[11px] font-medium">Add</span>
        </button>
      )}
    </div>
  )
}
