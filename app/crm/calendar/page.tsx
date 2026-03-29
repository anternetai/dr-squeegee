import { createClient } from "@/lib/supabase/server"
import { SqueegeeJob } from "@/lib/squeegee/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { CalendarDays, Clock, MapPin } from "lucide-react"

function getWeekDays(startDate: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    return d
  })
}

function toDateStr(date: Date): string {
  return date.toISOString().split("T")[0]
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

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}

export default async function CalendarPage() {
  const supabase = await createClient()

  // Fetch all scheduled/approved jobs with appointment dates
  const { data: jobs } = await supabase
    .from("squeegee_jobs")
    .select("*")
    .in("status", ["scheduled", "approved"])
    .not("appointment_date", "is", null)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })

  const allJobs = (jobs || []) as SqueegeeJob[]

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekDays = getWeekDays(today)
  const weekStart = toDateStr(weekDays[0])
  const weekEnd = toDateStr(weekDays[6])

  // Group jobs into week buckets
  const weekJobsMap: Record<string, SqueegeeJob[]> = {}
  for (const day of weekDays) {
    weekJobsMap[toDateStr(day)] = []
  }

  const weekJobs: SqueegeeJob[] = []
  const futureJobs: SqueegeeJob[] = []

  for (const job of allJobs) {
    if (!job.appointment_date) continue
    if (job.appointment_date >= weekStart && job.appointment_date <= weekEnd) {
      weekJobs.push(job)
      weekJobsMap[job.appointment_date] = [
        ...(weekJobsMap[job.appointment_date] || []),
        job,
      ]
    } else if (job.appointment_date > weekEnd) {
      futureJobs.push(job)
    }
  }

  const hasWeekJobs = weekJobs.length > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Scheduled &amp; approved jobs · This week
        </p>
      </div>

      {/* Week view */}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dateStr = toDateStr(day)
          const dayJobs = weekJobsMap[dateStr] || []
          const today_ = isToday(day)

          return (
            <div
              key={dateStr}
              className={`rounded-lg border ${
                today_
                  ? "border-[#3A6B4C] bg-[#F2F7F3] dark:bg-[#121E16]"
                  : "border-border bg-card"
              } flex flex-col min-h-[80px] overflow-hidden`}
            >
              {/* Day header */}
              <div
                className={`px-2 py-1.5 text-xs font-semibold ${
                  today_
                    ? "text-[#3A6B4C] bg-[#E8F0EA] dark:bg-[#182A1E]"
                    : "text-muted-foreground bg-muted/40"
                }`}
              >
                {formatDayLabel(day)}
                {today_ && (
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-wider opacity-70">
                    Today
                  </span>
                )}
              </div>

              {/* Jobs */}
              <div className="flex flex-col gap-1 p-1.5 flex-1">
                {dayJobs.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground/50 text-center py-2">—</p>
                ) : (
                  dayJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/crm/jobs/${job.id}`}
                      className="block rounded-md bg-[#3A6B4C]/10 hover:bg-[#3A6B4C]/20 border border-[#3A6B4C]/20 px-2 py-1.5 transition-colors group"
                    >
                      <p className="text-xs font-semibold text-[#234A32] dark:text-[#A8C4B0] truncate group-hover:underline">
                        {job.client_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">{job.service_type}</p>
                      {job.appointment_time && (
                        <p className="text-[11px] text-[#3A6B4C] font-medium">
                          {formatTime(job.appointment_time)}
                        </p>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* If no jobs this week, show upcoming list */}
      {!hasWeekJobs && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#3A6B4C]" />
              Upcoming This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {futureJobs.length === 0 ? (
              <div className="px-6 py-10 text-center text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-25" />
                <p className="text-sm">No scheduled jobs coming up.</p>
                <p className="text-xs mt-1">
                  Jobs with status &quot;Scheduled&quot; or &quot;Approved&quot; and an appointment date will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {futureJobs.slice(0, 20).map((job) => (
                  <Link
                    key={job.id}
                    href={`/crm/jobs/${job.id}`}
                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="pt-0.5 shrink-0 text-center">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {new Date(job.appointment_date! + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                        </p>
                        <p className="text-lg font-bold leading-none">
                          {new Date(job.appointment_date! + "T00:00:00").getDate()}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{job.client_name}</p>
                        <p className="text-xs text-muted-foreground">{job.service_type}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {job.address}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 ml-3 text-right">
                      {job.appointment_time && (
                        <p className="text-sm text-[#3A6B4C] font-medium flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatTime(job.appointment_time)}
                        </p>
                      )}
                      {job.price != null && (
                        <p className="text-xs text-muted-foreground">${Number(job.price).toFixed(2)}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* If there are jobs this week, also show next upcoming */}
      {hasWeekJobs && futureJobs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#3A6B4C]" />
              After This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {futureJobs.slice(0, 10).map((job) => (
                <Link
                  key={job.id}
                  href={`/crm/jobs/${job.id}`}
                  className="flex items-center justify-between px-6 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="pt-0.5 shrink-0 text-center min-w-[2.5rem]">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {new Date(job.appointment_date! + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                      </p>
                      <p className="text-lg font-bold leading-none">
                        {new Date(job.appointment_date! + "T00:00:00").getDate()}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{job.client_name}</p>
                      <p className="text-xs text-muted-foreground">{job.service_type}</p>
                    </div>
                  </div>
                  {job.appointment_time && (
                    <p className="text-sm text-[#3A6B4C] font-medium flex items-center gap-1 shrink-0 ml-3">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTime(job.appointment_time)}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
