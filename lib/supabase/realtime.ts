"use client"

import { useEffect } from "react"
import { createClient } from "./client"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

type ChangeEvent = "INSERT" | "UPDATE" | "DELETE"

interface UseRealtimeOptions {
  table: string
  filter?: string
  event?: ChangeEvent | "*"
  onInsert?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onUpdate?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onDelete?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  onChange?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void
  enabled?: boolean
}

export function useRealtimeSubscription({
  table,
  filter,
  event = "*",
  onInsert,
  onUpdate,
  onDelete,
  onChange,
  enabled = true,
}: UseRealtimeOptions) {
  useEffect(() => {
    if (!enabled) return

    const supabase = createClient()
    const channelName = `realtime-${table}-${filter || "all"}`

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        {
          event,
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          onChange?.(payload)
          if (payload.eventType === "INSERT") onInsert?.(payload)
          if (payload.eventType === "UPDATE") onUpdate?.(payload)
          if (payload.eventType === "DELETE") onDelete?.(payload)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter, event, onInsert, onUpdate, onDelete, onChange, enabled])
}
