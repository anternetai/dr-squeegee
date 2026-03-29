"use client"

import { useState, useEffect, useCallback } from "react"
import { SqueegeeActivityItem } from "@/lib/squeegee/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Activity,
  FileText,
  CheckCircle2,
  DollarSign,
  MessageSquare,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react"

const REFRESH_INTERVAL = 30_000 // 30 seconds

function getIcon(type: string) {
  if (type.startsWith("status_")) return ArrowRight
  if (type === "invoice_created") return FileText
  if (type === "invoice_paid") return DollarSign
  if (type === "invoice_sent") return CheckCircle2
  if (type === "note") return MessageSquare
  return Activity
}

function getIconColor(type: string) {
  if (type.startsWith("status_")) return "text-[#3A6B4C]"
  if (type === "invoice_created") return "text-blue-600 dark:text-blue-400"
  if (type === "invoice_paid") return "text-green-600 dark:text-green-400"
  if (type === "invoice_sent") return "text-purple-600 dark:text-purple-400"
  return "text-muted-foreground"
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 2) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

interface Props {
  jobId: string
}

export function JobActivity({ jobId }: Props) {
  const [items, setItems] = useState<SqueegeeActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/squeegee/jobs/${jobId}/activity`)
      if (res.ok) {
        const data = await res.json()
        setItems(Array.isArray(data) ? data : (data.activity || []))
        setLastRefreshed(new Date())
        setError(false)
      } else {
        setError(true)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchActivity()
    const interval = setInterval(fetchActivity, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchActivity])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#3A6B4C]" />
            <CardTitle className="text-base">Activity</CardTitle>
          </div>
          {lastRefreshed && (
            <p className="text-[11px] text-muted-foreground/60">
              Updated {formatRelativeTime(lastRefreshed.toISOString())}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading activity…</span>
          </div>
        ) : error ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400 opacity-60" />
            <p className="text-sm">Failed to load activity.</p>
            <button
              onClick={fetchActivity}
              className="mt-2 text-xs text-[#3A6B4C] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-25" />
            <p className="text-sm">No activity logged yet.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[1.1rem] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-4">
              {items.map((item) => {
                const Icon = getIcon(item.type)
                const iconColor = getIconColor(item.type)
                return (
                  <div key={item.id} className="flex items-start gap-3 relative">
                    {/* Icon bubble */}
                    <div
                      className={`shrink-0 w-[2.2rem] h-[2.2rem] rounded-full bg-card border border-border flex items-center justify-center z-10 ${iconColor}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm leading-snug">{item.note}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatRelativeTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
