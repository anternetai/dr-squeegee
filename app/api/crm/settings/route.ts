import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyCrmAuth } from "@/lib/crm-auth-check"
import {
  loadSettings,
  positiveMoney,
  saveSetting,
  SETTINGS_KEYS,
  type SettingsKey,
} from "@/lib/squeegee/settings"
import { mergeCadence } from "@/lib/squeegee/cadence"

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ settings: await loadSettings(getAdmin()) })
}

function clampInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" ? Number(v) : v
  if (typeof n !== "number" || !Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, Math.round(n)))
}

/**
 * Coerce one setting to the shape squeegee_settings is allowed to hold, or
 * return undefined to reject it. Every key is validated here — the route never
 * passes a request body through to the row, so a typo in the client can't park
 * garbage in a jsonb column that parseSettings then has to defend against.
 */
function coerce(key: SettingsKey, raw: unknown): unknown | undefined {
  switch (key) {
    case "solo_revenue_per_hour": {
      if (raw === null || raw === "") return null
      return positiveMoney(raw) ?? undefined
    }
    case "rebook_daily_cap":
      return clampInt(raw, 0, 50) ?? undefined
    case "cadence_months":
      if (!raw || typeof raw !== "object") return undefined
      return mergeCadence(raw)
    case "automations": {
      if (!raw || typeof raw !== "object") return undefined
      const src = raw as Record<string, unknown>
      const out: Record<string, boolean> = {}
      for (const k of ["followups", "rebooks", "missedCall", "digest"]) {
        if (typeof src[k] === "boolean") out[k] = src[k] as boolean
      }
      return Object.keys(out).length ? out : undefined
    }
    case "quiet_hours": {
      if (!raw || typeof raw !== "object") return undefined
      const src = raw as Record<string, unknown>
      const start = clampInt(src.start, 0, 23)
      const end = clampInt(src.end, 1, 24)
      if (start == null || end == null || end <= start) return undefined
      return { start, end }
    }
  }
}

// PATCH — one or more known settings keys. Anything else in the body is ignored.
export async function PATCH(request: NextRequest) {
  if (!(await verifyCrmAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const supabase = getAdmin()
  const written: SettingsKey[] = []

  for (const key of SETTINGS_KEYS) {
    if (!(key in body)) continue
    const value = coerce(key, (body as Record<string, unknown>)[key])
    if (value === undefined) {
      return NextResponse.json({ error: `That ${key.replace(/_/g, " ")} value isn't valid.` }, { status: 400 })
    }
    await saveSetting(supabase, key, value)
    written.push(key)
  }

  if (written.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  return NextResponse.json({ ok: true, settings: await loadSettings(supabase) })
}
