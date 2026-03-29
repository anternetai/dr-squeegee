export interface GpsPin {
  lat: number
  lng: number
  label?: string
  result?: "knocked" | "opened" | "pitched" | "closed" | "skip"
  ts: string
}

export interface DoorKnockSession {
  id: string
  created_at: string
  knocked_at: string
  session_date: string
  neighborhood: string
  street: string | null
  notes: string | null
  doors_knocked: number
  doors_opened: number
  pitches_given: number
  jobs_closed: number
  revenue_closed: number
  session_minutes: number | null
  weather: string | null
  gps_pins: GpsPin[] | null
}

export interface DoorKnockNeighborhood {
  id: string
  name: string
  notes: string | null
  address: string | null
  center_lat: number | null
  center_lng: number | null
  zoom_level: number | null
  created_at: string
}

export interface KnockStats {
  allTimeKnocked: number
  allTimeOpened: number
  allTimePitched: number
  allTimeClosed: number
  allTimeRevenue: number
  allTimeSessions: number
  todayKnocked: number
  todayOpened: number
  todayPitched: number
  todayClosed: number
  todayRevenue: number
  todaySessions: number
  weekKnocked: number
  weekOpened: number
  weekPitched: number
  weekClosed: number
  currentStreak: number
  bestStreak: number
  bestNeighborhood: string | null
  bestNeighborhoodCloseRate: number | null
  avgDoorsPerHour: number | null
}

export interface DoorVisit {
  date: string
  time?: string
  answered: boolean
  pitched?: boolean
  closed?: boolean
  not_interested?: boolean
  notes?: string
  revenue?: number
}

export interface TerritoryDoor {
  id: string
  neighborhood: string
  lat: number
  lng: number
  visits: DoorVisit[]
  status: string
  total_visits: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MoveStats {
  // Client progress
  activeClients: number
  clientNames: string[]

  // Cold calls — this week
  weekDials: number
  weekConversations: number
  weekDemos: number

  // Cold calls — today
  todayDials: number

  // Door knocks — this week
  weekDoorsKnocked: number
  weekDoorsOpened: number
  weekPitchesGiven: number
  weekJobsClosed: number

  // PW bridge income — this month
  monthPWRevenue: number
  monthPWJobs: number

  // Computed
  daysUntilMove: number
  currentPhase: string
}
