"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { SqueegeeJob, STATUS_ORDER, STATUS_LABELS, JobStatus } from "@/lib/squeegee/types"
import { formatDate, formatTime } from "@/lib/squeegee/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  ChevronRight,
  Check,
  Copy,
  MessageSquare,
  CalendarCheck,
  Loader2,
  Pencil,
  Save,
  X,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  FileText,
  Clock,
  CalendarPlus,
  CalendarSync,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_COLORS: Record<JobStatus, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  quoted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
  approved: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  scheduled: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  complete: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800",
}

interface Props {
  job: SqueegeeJob
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn(
        "gap-1.5 transition-colors",
        copied && "border-green-500 text-green-600"
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </Button>
  )
}

async function syncCalendar(jobId: string, action: "create" | "delete") {
  try {
    if (action === "create") {
      await fetch(`/api/squeegee/jobs/${jobId}/gcal`, { method: "POST" })
    } else {
      await fetch(`/api/squeegee/jobs/${jobId}/gcal`, { method: "DELETE" })
    }
  } catch {
    // Calendar sync is best-effort — don't block status changes
  }
}

export function JobDetailClient({ job: initialJob }: Props) {
  const router = useRouter()
  const [job, setJob] = useState(initialJob)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [calSyncing, setCalSyncing] = useState(false)
  const [calSynced, setCalSynced] = useState(!!initialJob.google_calendar_event_id)
  const [deleting, setDeleting] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState({
    client_name: job.client_name,
    client_phone: job.client_phone || "",
    client_email: job.client_email || "",
    address: job.address,
    service_type: job.service_type,
    notes: job.notes || "",
    price: job.price != null ? String(job.price) : "",
    appointment_date: job.appointment_date || "",
    appointment_time: job.appointment_time || "",
  })

  // Generated messages
  const quoteText = `Hey ${job.client_name.split(" ")[0]}! This is Anthony from Dr. Squeegee. Here's your quote for ${job.service_type} at ${job.address}: $${job.price != null ? Number(job.price).toFixed(2) : "TBD"}. Does this work for you? Reply YES to approve and I'll get you on the schedule!`

  const confirmText =
    job.appointment_date && job.appointment_time
      ? `Hey ${job.client_name.split(" ")[0]}! Confirming your Dr. Squeegee appointment for ${job.service_type} at ${job.address} on ${formatDate(job.appointment_date)} at ${formatTime(job.appointment_time)}. We'll see you then! Any questions, just reply here.`
      : null

  const currentStatusIdx = STATUS_ORDER.indexOf(job.status)
  const nextStatus = STATUS_ORDER[currentStatusIdx + 1] as JobStatus | undefined

  // Leaving 'scheduled' for anything other than 'complete' is treated as an
  // unschedule: cancels the Cal.com booking + clears appointment fields via
  // the schedule route, then (if the target isn't 'approved', which is what
  // unschedule defaults to) finishes the move to the requested status.
  // 'complete' is exempt — the appointment already happened, keep the record.
  async function leaveScheduled(newStatus: JobStatus): Promise<boolean> {
    try {
      const res = await fetch(`/api/squeegee/jobs/${job.id}/schedule`, { method: "DELETE" })
      if (!res.ok) return false
      const data = (await res.json()) as SqueegeeJob
      setJob(data)
      if (job.google_calendar_event_id) {
        await syncCalendar(job.id, "delete")
      }
      setCalSynced(false)
      if (newStatus !== "approved") {
        const supabase = createClient()
        const { data: final, error } = await supabase
          .from("squeegee_jobs")
          .update({ status: newStatus })
          .eq("id", job.id)
          .select("*")
          .single()
        if (!error && final) setJob(final as SqueegeeJob)
      }
      return true
    } catch {
      return false
    }
  }

  async function advanceStatus() {
    if (!nextStatus) return
    if (nextStatus === "scheduled") return // enforced via the Schedule card below
    setUpdatingStatus(true)
    if (job.status === "scheduled") {
      await leaveScheduled(nextStatus)
      setUpdatingStatus(false)
      return
    }
    const supabase = createClient()
    const { data, error } = await supabase
      .from("squeegee_jobs")
      .update({ status: nextStatus })
      .eq("id", job.id)
      .select("*")
      .single()
    if (!error && data) setJob(data as SqueegeeJob)
    setUpdatingStatus(false)
  }

  async function setStatus(status: JobStatus) {
    if (status === "scheduled") {
      alert("Use the Schedule card below to pick a date & time — jobs can't move to Scheduled without booking a slot.")
      return
    }
    setUpdatingStatus(true)
    if (job.status === "scheduled") {
      await leaveScheduled(status)
      setUpdatingStatus(false)
      return
    }
    const supabase = createClient()
    const { data, error } = await supabase
      .from("squeegee_jobs")
      .update({ status })
      .eq("id", job.id)
      .select("*")
      .single()
    if (!error && data) setJob(data as SqueegeeJob)
    setUpdatingStatus(false)
  }

  async function saveEdit() {
    setSavingEdit(true)
    setEditError(null)
    const supabase = createClient()

    const payload: Partial<SqueegeeJob> = {
      client_name: editForm.client_name.trim(),
      client_phone: editForm.client_phone.trim() || undefined,
      client_email: editForm.client_email.trim() || undefined,
      address: editForm.address.trim(),
      service_type: editForm.service_type,
      notes: editForm.notes.trim() || undefined,
      price: editForm.price ? parseFloat(editForm.price) : undefined,
      appointment_date: editForm.appointment_date || null,
      appointment_time: editForm.appointment_time || null,
    }

    const { data, error } = await supabase
      .from("squeegee_jobs")
      .update(payload)
      .eq("id", job.id)
      .select("*")
      .single()

    if (error) {
      setEditError(error.message)
    } else if (data) {
      setJob(data as SqueegeeJob)
      setEditing(false)
      router.refresh()
    }
    setSavingEdit(false)
  }

  function startEdit() {
    setEditForm({
      client_name: job.client_name,
      client_phone: job.client_phone || "",
      client_email: job.client_email || "",
      address: job.address,
      service_type: job.service_type,
      notes: job.notes || "",
      price: job.price != null ? String(job.price) : "",
      appointment_date: job.appointment_date || "",
      appointment_time: job.appointment_time || "",
    })
    setEditing(true)
  }

  async function deleteJob() {
    if (!window.confirm(`Delete job for ${job.client_name}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/squeegee/jobs/${job.id}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.error ?? "Failed to delete job.")
        setDeleting(false)
        return
      }
      router.push("/crm/jobs")
    } catch {
      alert("Network error — job was not deleted.")
      setDeleting(false)
    }
  }

  const showAppointmentFields =
    job.status === "approved" || job.status === "scheduled" || job.status === "complete"

  return (
    <div className="space-y-5">
      {/* Status progression */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-1">
            {STATUS_ORDER.map((status, idx) => {
              const isCurrent = job.status === status
              const isPast = currentStatusIdx > idx
              return (
                <div key={status} className="flex items-center gap-1">
                  <button
                    onClick={() => setStatus(status as JobStatus)}
                    disabled={updatingStatus}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                      isCurrent
                        ? STATUS_COLORS[status as JobStatus]
                        : isPast
                        ? "border-border bg-muted text-muted-foreground opacity-60 hover:opacity-80"
                        : "border-border text-muted-foreground hover:bg-muted/60"
                    )}
                  >
                    {isPast && <Check className="inline h-3 w-3 mr-1" />}
                    {STATUS_LABELS[status as JobStatus]}
                  </button>
                  {idx < STATUS_ORDER.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              )
            })}
          </div>

          {nextStatus && nextStatus !== "scheduled" && (
            <div className="mt-3">
              <Button
                size="sm"
                onClick={advanceStatus}
                disabled={updatingStatus}
                className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white"
              >
                {updatingStatus && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Mark as {STATUS_LABELS[nextStatus]}
              </Button>
            </div>
          )}
          {nextStatus === "scheduled" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Pick a date &amp; time in the Schedule section below to move this job to Scheduled.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Job info */}
      {editing ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Edit Job</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white"
                >
                  {savingEdit ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {editError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {editError}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client Name</Label>
                <Input value={editForm.client_name} onChange={(e) => setEditForm((p) => ({ ...p, client_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={editForm.client_phone} onChange={(e) => setEditForm((p) => ({ ...p, client_phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Email</Label>
                <Input value={editForm.client_email} onChange={(e) => setEditForm((p) => ({ ...p, client_email: e.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Input value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Price ($)</Label>
                <Input type="number" min="0" step="0.01" value={editForm.price} onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Appointment Date</Label>
                <Input type="date" value={editForm.appointment_date} onChange={(e) => setEditForm((p) => ({ ...p, appointment_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Appointment Time</Label>
                <Input type="time" value={editForm.appointment_time} onChange={(e) => setEditForm((p) => ({ ...p, appointment_time: e.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Job Info</CardTitle>
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <InfoRow icon={Phone} label="Phone" value={job.client_phone} />
              <InfoRow icon={Mail} label="Email" value={job.client_email} />
              <InfoRow icon={MapPin} label="Address" value={job.address} className="sm:col-span-2" />
              <InfoRow icon={FileText} label="Service" value={job.service_type} />
              <InfoRow
                icon={DollarSign}
                label="Price"
                value={job.price != null ? `$${Number(job.price).toFixed(2)}` : null}
              />
              {showAppointmentFields && (
                <>
                  <InfoRow icon={Clock} label="Appt. Date" value={job.appointment_date ? formatDate(job.appointment_date) : "Not set"} />
                  <InfoRow icon={Clock} label="Appt. Time" value={job.appointment_time ? formatTime(job.appointment_time) : "Not set"} />
                </>
              )}
              {job.notes && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule — the enforced path to a booked slot (Cal.com + status -> scheduled) */}
      {!editing && (job.status === "quoted" || job.status === "approved" || job.status === "scheduled") && (
        <ScheduleCard job={job} onUpdate={setJob} />
      )}

      {/* Manual Google sync button removed: the OAuth integration was never
          configured in prod (env vars absent since March), and Cal.com
          scheduling now lands on the same Google Calendar automatically —
          the button could only error or double-book. .ics download stays. */}
      {job.appointment_date && (
        <div className="flex gap-2">
          <Button asChild variant="outline" className="flex-1 gap-2" title="Download .ics file">
            <a href={`/api/squeegee/jobs/${job.id}/calendar`} download>
              <CalendarPlus className="h-4 w-4" />
              Download .ics
            </a>
          </Button>
        </div>
      )}

      {/* Care Club upsell — the moment the job's done is the moment to pitch */}
      {job.client_phone && (
        <div className="flex items-center gap-3 rounded-xl border border-[#2D8C6F]/40 bg-[#2D8C6F]/5 px-4 py-3">
          <Sparkles className="h-5 w-5 text-[#2D8C6F] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Job done? Pitch the Care Club.</p>
            <p className="text-xs text-muted-foreground">
              Their pricing history loads automatically — member rates in one tap.
            </p>
          </div>
          <Button asChild size="sm" className="bg-[#2D8C6F] hover:bg-[#1F6B54] text-white shrink-0">
            <Link href={`/crm/pitch?phone=${job.client_phone.replace(/[^0-9]/g, "").slice(-10)}`}>
              Pitch
            </Link>
          </Button>
        </div>
      )}

      {/* Add another quote — one flow, prefilled with this client so it's never re-typed */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-[#3A6B4C] shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Send another quote</p>
                <p className="text-xs text-muted-foreground truncate">
                  Opens the quote builder with {job.client_name.split(" ")[0]} already picked.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link
                href={
                  job.client_id
                    ? `/crm/quotes/new?client_id=${job.client_id}`
                    : `/crm/quotes/new?client_name=${encodeURIComponent(job.client_name)}&client_phone=${encodeURIComponent(job.client_phone || "")}&client_email=${encodeURIComponent(job.client_email || "")}&address=${encodeURIComponent(job.address)}`
                }
              >
                New Quote
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generate Quote Text */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#3A6B4C]" />
            <CardTitle className="text-base">Quote Message</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm bg-muted rounded-lg p-4 whitespace-pre-wrap font-mono leading-relaxed">
            {quoteText}
          </p>
          <div className="flex gap-2">
            <CopyButton text={quoteText} />
            {job.client_phone && (
              <Button
                asChild
                variant="default"
                size="sm"
                className="gap-1.5 bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white"
              >
                <a href={`sms:${job.client_phone.replace(/[^\d+]/g, "")}&body=${encodeURIComponent(quoteText)}`}>
                  <Send className="h-3.5 w-3.5" />
                  Text Quote
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generate Appointment Confirmation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-[#3A6B4C]" />
            <CardTitle className="text-base">Appointment Confirmation</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {confirmText ? (
            <>
              <p className="text-sm bg-muted rounded-lg p-4 whitespace-pre-wrap font-mono leading-relaxed">
                {confirmText}
              </p>
              <div className="flex gap-2">
                <CopyButton text={confirmText} />
                {job.client_phone && (
                  <Button
                    asChild
                    variant="default"
                    size="sm"
                    className="gap-1.5 bg-[#3A6B4C] hover:bg-[#2F5A3F] text-white"
                  >
                    <a href={`sms:${job.client_phone.replace(/[^\d+]/g, "")}&body=${encodeURIComponent(confirmText)}`}>
                      <Send className="h-3.5 w-3.5" />
                      Text Confirm
                    </a>
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Set an appointment date and time to generate the confirmation message.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-4">
        <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-3">
          Danger Zone
        </p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Delete this job</p>
            <p className="text-xs text-muted-foreground">
              Permanently removes the job, quotes, invoices, and all activity. Cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={deleteJob}
            disabled={deleting}
            className="shrink-0 gap-1.5"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {deleting ? "Deleting…" : "Delete Job"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType
  label: string
  value?: string | null
  className?: string
}) {
  if (!value) return null
  const isAddress = label === "Address"
  const isPhone = label === "Phone"
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {isAddress ? (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(value)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#3A6B4C] hover:underline"
          >
            {value}
          </a>
        ) : isPhone ? (
          <a
            href={`sms:${value.replace(/[^\d+]/g, "")}`}
            className="text-sm text-[#3A6B4C] hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm">{value}</p>
        )}
      </div>
    </div>
  )
}

function ScheduleCard({
  job,
  onUpdate,
}: {
  job: SqueegeeJob
  onUpdate: (j: SqueegeeJob) => void
}) {
  const isScheduled = job.status === "scheduled" && !!job.appointment_date
  const [editing, setEditing] = useState(!isScheduled)
  const [date, setDate] = useState(job.appointment_date || "")
  const [time, setTime] = useState(job.appointment_time ? job.appointment_time.slice(0, 5) : "")
  const [saving, setSaving] = useState(false)
  const [unscheduling, setUnscheduling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSchedule() {
    if (!date || !time) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/squeegee/jobs/${job.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to schedule")
        return
      }
      onUpdate(data as SqueegeeJob)
      setEditing(false)
    } catch {
      setError("Network error — job was not scheduled.")
    } finally {
      setSaving(false)
    }
  }

  async function handleUnschedule() {
    if (!window.confirm("Remove this job from the schedule?")) return
    setUnscheduling(true)
    setError(null)
    try {
      // Clean up the legacy Google Calendar event too, if one was manually synced.
      if (job.google_calendar_event_id) {
        await syncCalendar(job.id, "delete")
      }
      const res = await fetch(`/api/squeegee/jobs/${job.id}/schedule`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) {
        onUpdate(data as SqueegeeJob)
        setDate("")
        setTime("")
        setEditing(true)
      } else {
        setError(data.error || "Failed to unschedule")
      }
    } catch {
      setError("Network error — job was not unscheduled.")
    } finally {
      setUnscheduling(false)
    }
  }

  return (
    <Card className="border-[#2D8C6F]/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-[#2D8C6F]" />
            <CardTitle className="text-base">Schedule</CardTitle>
          </div>
          {isScheduled && !editing && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
              Scheduled
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
        )}

        {isScheduled && !editing ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {formatDate(job.appointment_date!)} at {formatTime(job.appointment_time!)}
              </p>
              <p className="text-xs text-muted-foreground">
                {job.cal_booking_uid
                  ? "Synced to Google Calendar via Cal.com"
                  : "In CRM only — Cal.com sync unavailable"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Reschedule
              </Button>
              <Button size="sm" variant="destructive" onClick={handleUnschedule} disabled={unscheduling}>
                {unscheduling ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5 mr-1.5" />
                )}
                Unschedule
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-36" />
            </div>
            <Button
              onClick={handleSchedule}
              disabled={saving || !date || !time}
              size="sm"
              className="bg-[#2D8C6F] hover:bg-[#1F6B54] text-white"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <CalendarCheck className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isScheduled ? "Save New Time" : "Schedule"}
            </Button>
            {isScheduled && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false)
                  setError(null)
                  setDate(job.appointment_date || "")
                  setTime(job.appointment_time ? job.appointment_time.slice(0, 5) : "")
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
