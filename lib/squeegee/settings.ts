// CRM settings, stored as key/value jsonb rows in squeegee_settings so Anthony
// can change cadences and flip automations from his phone instead of Vercel.
// parseSettings is pure and defensive: a bad row falls back to its default
// rather than taking a page down.

import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_CADENCE_MONTHS, mergeCadence, type CadenceMonths } from "./cadence.ts"

export interface AutomationToggles {
  /** Automatic quote follow-up texts at day 2 / 7 / 14. */
  followups: boolean
  /** Automatic "due for service" rebook texts to consented clients. */
  rebooks: boolean
  /** Text-back when a call to the business line goes unanswered by everyone. */
  missedCall: boolean
  /** Monday owner digest to Slack. */
  digest: boolean
}

export interface CrmSettings {
  cadenceMonths: CadenceMonths
  automations: AutomationToggles
  /** Max rebook texts per cron run (carrier-reputation protection). */
  rebookDailyCap: number
  /** ET hours; sends allowed from start (inclusive) to end (exclusive). */
  quietHours: { start: number; end: number }
}

export const SETTINGS_KEYS = ["cadence_months", "automations", "rebook_daily_cap", "quiet_hours"] as const
export type SettingsKey = (typeof SETTINGS_KEYS)[number]

export const DEFAULT_SETTINGS: CrmSettings = {
  cadenceMonths: DEFAULT_CADENCE_MONTHS,
  automations: { followups: true, rebooks: true, missedCall: true, digest: true },
  rebookDailyCap: 3,
  quietHours: { start: 9, end: 20 },
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback
}

function int(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "string" ? Number(v) : v
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function parseSettings(rows: { key: string; value: unknown }[] | null | undefined): CrmSettings {
  const byKey = new Map<string, unknown>()
  for (const r of rows ?? []) byKey.set(r.key, r.value)

  const auto = (byKey.get("automations") ?? {}) as Record<string, unknown>
  const quiet = (byKey.get("quiet_hours") ?? {}) as Record<string, unknown>
  const start = int(quiet.start, DEFAULT_SETTINGS.quietHours.start, 0, 23)
  const end = int(quiet.end, DEFAULT_SETTINGS.quietHours.end, 1, 24)

  return {
    cadenceMonths: mergeCadence(byKey.get("cadence_months")),
    automations: {
      followups: bool(auto.followups, DEFAULT_SETTINGS.automations.followups),
      rebooks: bool(auto.rebooks, DEFAULT_SETTINGS.automations.rebooks),
      missedCall: bool(auto.missedCall, DEFAULT_SETTINGS.automations.missedCall),
      digest: bool(auto.digest, DEFAULT_SETTINGS.automations.digest),
    },
    rebookDailyCap: int(byKey.get("rebook_daily_cap"), DEFAULT_SETTINGS.rebookDailyCap, 0, 50),
    quietHours: end > start ? { start, end } : { ...DEFAULT_SETTINGS.quietHours },
  }
}

/** Service-role read. Throws on a real query error (a missing table is a
 *  deploy bug, not a condition to hide). */
export async function loadSettings(sb: SupabaseClient): Promise<CrmSettings> {
  const { data, error } = await sb.from("squeegee_settings").select("key, value")
  if (error) throw new Error(`loadSettings: ${error.message}`)
  return parseSettings((data ?? []) as { key: string; value: unknown }[])
}

/** Write one key. Callers validate the shape first (see the settings route). */
export async function saveSetting(sb: SupabaseClient, key: SettingsKey, value: unknown): Promise<void> {
  const { error } = await sb
    .from("squeegee_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
  if (error) throw new Error(`saveSetting(${key}): ${error.message}`)
}
