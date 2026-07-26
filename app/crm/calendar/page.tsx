import Link from "next/link"
import { createClient } from "@supabase/supabase-js"
import { SqueegeeJob, JobStatus } from "@/lib/squeegee/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { NeedsScheduling, type NeedsSchedulingItem } from "@/components/squeegee/needs-scheduling"

export const dynamic = "force-dynamic"

// Service-role: the CRM is gated by the signed crm_auth cookie in middleware,
// not by a Supabase session, so these queries have no authenticated identity.
// Reading them through the anon key is what forced RLS open to anon.
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const CHIP_COLORS: Record<JobStatus, string> = {
  new: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/20",
  quoted: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border-yellow-500/20",
  approved: "bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-500/20",
  scheduled: "bg-[#2D8C6F]/15 text-[#1F6B54] dark:text-[#5FBFA0] border-[#2D8C6F]/25",
  complete: "bg-green-500/15 text-green-800 dark:text-green-300 border-green-500/20",
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** Today's calendar date in America/New_York, as "YYYY-MM-DD" — avoids UTC-server drift. */
function todayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

function dayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function lastDayOfMonth(year: number, month: number): number {
  // month is 1-indexed; Date.UTC's month param is 0-indexed, so passing
  // `month` (not month-1) with day 0 rolls back to the last day of `month`.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Builds a full-week-padded month grid of "YYYY-MM-DD" strings. */
function buildMonthGrid(year: number, month: number): string[][] {
  const firstOfMonth = `${year}-${pad2(month)}-01`
  const gridStart = addDays(firstOfMonth, -dayOfWeek(firstOfMonth))

  const lastDay = lastDayOfMonth(year, month)
  const lastOfMonth = `${year}-${pad2(month)}-${pad2(lastDay)}`
  const gridEnd = addDays(lastOfMonth, 6 - dayOfWeek(lastOfMonth))

  const days: string[] = []
  for (let cur = gridStart; cur <= gridEnd; cur = addDays(cur, 1)) {
    days.push(cur)
  }
  const weeks: string[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return ""
  const [hourStr, minuteStr] = timeStr.split(":")
  const hour = parseInt(hourStr, 10)
  const minute = minuteStr || "00"
  const ampm = hour >= 12 ? "PM" : "AM"
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${ampm}`
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

interface PageProps {
  searchParams: Promise<{ y?: string; m?: string }>
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const { y, m } = await searchParams
  const today = todayET()
  const [todayYear, todayMonth] = today.split("-").map(Number)

  const year = Number(y) || todayYear
  const month = Number(m) && Number(m) >= 1 && Number(m) <= 12 ? Number(m) : todayMonth

  const weeks = buildMonthGrid(year, month)
  const gridStart = weeks[0][0]
  const gridEnd = weeks[weeks.length - 1][6]

  // Current week (Sun-Sat containing "today"), independent of month nav —
  // always shows what's actually coming up this week.
  const weekStart = addDays(today, -dayOfWeek(today))
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const supabase = getAdmin()

  const [{ data: rangeJobs }, { data: weekJobsRaw }, { data: needsSchedJobs }] = await Promise.all([
    supabase
      .from("squeegee_jobs")
      .select("*")
      .gte("appointment_date", gridStart)
      .lte("appointment_date", gridEnd)
      .not("appointment_date", "is", null)
      .order("appointment_time", { ascending: true }),
    supabase
      .from("squeegee_jobs")
      .select("*")
      .gte("appointment_date", weekDays[0])
      .lte("appointment_date", weekDays[6])
      .not("appointment_date", "is", null)
      .order("appointment_time", { ascending: true }),
    supabase
      .from("squeegee_jobs")
      .select("id, client_name, service_type, price, created_at")
      .eq("status", "approved")
      .is("appointment_date", null)
      .order("created_at", { ascending: true }),
  ])

  const monthJobsByDate: Record<string, SqueegeeJob[]> = {}
  for (const job of (rangeJobs || []) as SqueegeeJob[]) {
    if (!job.appointment_date) continue
    ;(monthJobsByDate[job.appointment_date] ||= []).push(job)
  }

  const weekJobsByDate: Record<string, SqueegeeJob[]> = {}
  for (const job of (weekJobsRaw || []) as SqueegeeJob[]) {
    if (!job.appointment_date) continue
    ;(weekJobsByDate[job.appointment_date] ||= []).push(job)
  }

  const needsSchedulingItems: NeedsSchedulingItem[] = (needsSchedJobs || []).map((j) => ({
    id: j.id as string,
    clientName: j.client_name as string,
    serviceType: j.service_type as string,
    amount: j.price != null ? Number(j.price) : null,
    createdAt: j.created_at as string,
  }))

  // Prev/next month, wrapping year correctly.
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-sm text-muted-foreground">Booked jobs &amp; what still needs a slot</p>
      </div>

      {/* Needs scheduling — same tray as the dashboard */}
      <NeedsScheduling items={needsSchedulingItems} />

      {/* This week — agenda strip, always the real current week */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#3A6B4C]" />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {weekDays.map((dateStr) => {
              const dayJobs = weekJobsByDate[dateStr] || []
              const isToday = dateStr === today
              return (
                <div
                  key={dateStr}
                  className={`rounded-lg border ${
                    isToday
                      ? "border-[#3A6B4C] bg-[#F2F7F3] dark:bg-[#121E16]"
                      : "border-border bg-card"
                  } flex flex-col min-h-[70px] overflow-hidden`}
                >
                  <div
                    className={`px-2 py-1.5 text-xs font-semibold ${
                      isToday
                        ? "text-[#3A6B4C] bg-[#E8F0EA] dark:bg-[#182A1E]"
                        : "text-muted-foreground bg-muted/40"
                    }`}
                  >
                    {formatDayLabel(dateStr)}
                    {isToday && (
                      <span className="ml-1 text-[10px] font-bold uppercase tracking-wider opacity-70">
                        Today
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 p-1.5 flex-1">
                    {dayJobs.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/50 text-center py-2">—</p>
                    ) : (
                      dayJobs.map((job) => (
                        <Link
                          key={job.id}
                          href={`/crm/jobs/${job.id}`}
                          className={`block rounded-md border px-2 py-1 transition-colors hover:opacity-80 ${CHIP_COLORS[job.status]}`}
                        >
                          <p className="text-[11px] font-semibold truncate">{job.client_name}</p>
                          {job.appointment_time && (
                            <p className="text-[10px] opacity-80">{formatTime(job.appointment_time)}</p>
                          )}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Month grid */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {MONTH_NAMES[month - 1]} {year}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Link
                href={`/crm/calendar?y=${prevYear}&m=${prevMonth}`}
                className="p-1.5 rounded-md border border-border hover:bg-muted/60 transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <Link
                href="/crm/calendar"
                className="px-2 py-1.5 text-xs rounded-md border border-border hover:bg-muted/60 transition-colors"
              >
                Today
              </Link>
              <Link
                href={`/crm/calendar?y=${nextYear}&m=${nextMonth}`}
                className="p-1.5 rounded-md border border-border hover:bg-muted/60 transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wide py-1">
                {label}
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1.5">
                {week.map((dateStr) => {
                  const inMonth = Number(dateStr.slice(5, 7)) === month
                  const dayJobs = monthJobsByDate[dateStr] || []
                  const isToday = dateStr === today
                  const dayNum = Number(dateStr.slice(8, 10))
                  return (
                    <div
                      key={dateStr}
                      className={`rounded-lg border min-h-[84px] p-1 flex flex-col gap-1 ${
                        isToday
                          ? "border-[#3A6B4C] bg-[#F2F7F3] dark:bg-[#121E16]"
                          : inMonth
                          ? "border-border bg-card"
                          : "border-border/40 bg-muted/20"
                      }`}
                    >
                      <span
                        className={`text-[11px] font-semibold px-0.5 ${
                          isToday
                            ? "text-[#3A6B4C]"
                            : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                        }`}
                      >
                        {dayNum}
                      </span>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {dayJobs.slice(0, 3).map((job) => (
                          <Link
                            key={job.id}
                            href={`/crm/jobs/${job.id}`}
                            className={`block rounded border px-1 py-0.5 text-[10px] leading-tight truncate transition-colors hover:opacity-80 ${CHIP_COLORS[job.status]}`}
                            title={`${job.client_name} — ${job.service_type}`}
                          >
                            {job.appointment_time && <span className="font-medium">{formatTime(job.appointment_time)} </span>}
                            {job.client_name}
                          </Link>
                        ))}
                        {dayJobs.length > 3 && (
                          <span className="text-[9px] text-muted-foreground px-0.5">
                            +{dayJobs.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
