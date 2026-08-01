/* ---------------------------------------------------------------------------
   Doors module — domain types
   ---------------------------------------------------------------------------
   Ported from anternetai/doors (lib/types.ts, lib/kpis.ts) when Doors folded
   into the CRM. Kept byte-compatible with the live tables `territories` and
   `doors_territory_doors` so the standalone repo and this copy read the same
   rows — 325 doors across 16 territories as of 2026-07-31.
--------------------------------------------------------------------------- */

export interface DoorVisit {
  date: string
  time?: string
  answered: boolean
  pitched?: boolean
  closed?: boolean
  not_interested?: boolean
  notes?: string
  revenue?: number
  photo?: string
  audioUrl?: string
}

export interface TerritoryDoor {
  id: string
  user_id: string
  territory_id: string
  lat: number
  lng: number
  visits: DoorVisit[]
  status: string
  total_visits: number
  notes: string | null
  created_at: string
  updated_at: string
  contact_name?: string | null
  contact_phone?: string | null
  contact_address?: string | null
  /** Set once a door has been bridged into a CRM client/job. Zero of the 325
   *  live rows have this — the standalone app's HTTP bridge never landed one.
   *  In-process now, so a close writes it directly. */
  crm_client_id?: string | null
  crm_job_id?: string | null
}

export interface Territory {
  id: string
  user_id: string
  name: string
  address: string | null
  center_lat: number | null
  center_lng: number | null
  zoom_level: number | null
  created_at: string
}

export interface TerritoryKpis {
  total_doors: number
  doors_answered: number
  doors_pitched: number
  doors_closed: number
  doors_not_interested: number
  contact_rate: number
  pitch_rate: number
  close_rate: number
  total_revenue: number
  avg_revenue_per_door: number
}

export interface TerritoryWithKpis extends Territory {
  kpis: TerritoryKpis
}

/** The four states a door can be in, collapsed onto the CRM's status ramp.
 *  Deliberately NOT the raw four-color scheme the standalone app used. */
export type DoorState = "unworked" | "answered" | "won" | "dead"

export function doorState(door: TerritoryDoor): DoorState {
  if (door.visits.length === 0) return "unworked"
  const latest = door.visits[door.visits.length - 1]
  if (latest.not_interested) return "dead"
  if (latest.closed || latest.pitched) return "won"
  if (latest.answered) return "answered"
  return "unworked"
}

export const DOOR_STATE_LABEL: Record<DoorState, string> = {
  unworked: "Not home",
  answered: "Answered",
  won: "Pitched / closed",
  dead: "Not interested",
}

/** Map pin colors. Literal hex, not var(--…): Leaflet writes these into SVG
 *  presentation attributes, which do not resolve CSS custom properties. These
 *  are the same four values as the --crm-* status tokens in globals.css — if
 *  you change one, change both. */
export const DOOR_STATE_COLOR: Record<DoorState, string> = {
  unworked: "#5f6672",
  answered: "#c8922f",
  won: "#2d8c6f",
  dead: "#b8453a",
}

export function computeKpis(doors: TerritoryDoor[]): TerritoryKpis {
  let doors_answered = 0
  let doors_pitched = 0
  let doors_closed = 0
  let doors_not_interested = 0
  let total_revenue = 0

  for (const door of doors) {
    for (const visit of door.visits ?? []) {
      if (visit.answered) doors_answered++
      if (visit.pitched) doors_pitched++
      if (visit.closed) {
        doors_closed++
        if (visit.revenue) total_revenue += visit.revenue
      }
      if (visit.not_interested) doors_not_interested++
    }
  }

  const total_doors = doors.length
  return {
    total_doors,
    doors_answered,
    doors_pitched,
    doors_closed,
    doors_not_interested,
    contact_rate: total_doors > 0 ? doors_answered / total_doors : 0,
    pitch_rate: doors_answered > 0 ? doors_pitched / doors_answered : 0,
    close_rate: doors_pitched > 0 ? doors_closed / doors_pitched : 0,
    total_revenue,
    avg_revenue_per_door: total_doors > 0 ? total_revenue / total_doors : 0,
  }
}
