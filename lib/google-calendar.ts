import { google } from "googleapis"
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendars.readonly",
  "https://www.googleapis.com/auth/calendar",
]

const REDIRECT_URI = "https://homefieldhub.com/api/google/callback"

// Admin Supabase client (service role) for reading/writing settings
function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─── Legacy helpers (used by squeegee portal gcal route) ──────────────────────

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CAL_CLIENT_ID,
    process.env.GOOGLE_CAL_CLIENT_SECRET,
    REDIRECT_URI
  )
  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })
  return client
}

function getLegacyCalendar() {
  return google.calendar({ version: "v3", auth: getOAuth2Client() })
}

interface JobEventData {
  client_name: string
  address: string
  service_type: string
  client_phone?: string | null
  price?: number | null
  appointment_date: string // "2026-03-15"
  appointment_time?: string | null // "14:30"
}

export async function createCalendarEvent(job: JobEventData) {
  const calendar = getLegacyCalendar()
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary"

  const timeStr = job.appointment_time || "09:00"
  const startDateTime = `${job.appointment_date}T${timeStr}:00`
  const startDate = new Date(startDateTime)
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000) // 2 hour block

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`
  const serviceName = job.service_type !== "Pending Quote" ? job.service_type : "Service"

  const description = [
    `Client: ${job.client_name}`,
    `Phone: ${job.client_phone || "N/A"}`,
    `Service: ${serviceName}`,
    `Price: $${job.price != null ? Number(job.price).toFixed(2) : "TBD"}`,
    "",
    `Directions: ${mapsUrl}`,
  ].join("\n")

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `Dr. Squeegee — ${job.client_name}`,
      location: job.address,
      description,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "America/New_York",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "America/New_York",
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 30 }],
      },
    },
  })

  return event.data.id
}

export async function updateCalendarEvent(
  eventId: string,
  job: JobEventData
) {
  const calendar = getLegacyCalendar()
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary"

  const timeStr = job.appointment_time || "09:00"
  const startDateTime = `${job.appointment_date}T${timeStr}:00`
  const startDate = new Date(startDateTime)
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000)

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`
  const serviceName = job.service_type !== "Pending Quote" ? job.service_type : "Service"

  const description = [
    `Client: ${job.client_name}`,
    `Phone: ${job.client_phone || "N/A"}`,
    `Service: ${serviceName}`,
    `Price: $${job.price != null ? Number(job.price).toFixed(2) : "TBD"}`,
    "",
    `Directions: ${mapsUrl}`,
  ].join("\n")

  await calendar.events.update({
    calendarId,
    eventId,
    requestBody: {
      summary: `Dr. Squeegee — ${job.client_name}`,
      location: job.address,
      description,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "America/New_York",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "America/New_York",
      },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 30 }],
      },
    },
  })
}

export async function deleteCalendarEvent(eventId: string) {
  const calendar = getLegacyCalendar()
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary"

  await calendar.events.delete({
    calendarId,
    eventId,
  })
}

// ─── New OAuth2 + Calendar management ─────────────────────────────────────────

/**
 * Build an OAuth2 client. If a refresh token is available (from env or Supabase),
 * it is set and the client can make authenticated requests immediately.
 */
export async function getAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CAL_CLIENT_ID,
    process.env.GOOGLE_CAL_CLIENT_SECRET,
    REDIRECT_URI
  )

  // Try to get refresh token — env first, then Supabase
  let refreshToken = process.env.GOOGLE_REFRESH_TOKEN || null

  if (!refreshToken) {
    const supabase = getAdminSupabase()
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "google_refresh_token")
      .single()

    if (data?.value) {
      refreshToken = data.value as string
    }
  }

  if (refreshToken) {
    oauth2Client.setCredentials({ refresh_token: refreshToken })
  }

  // Auto-refresh: save new access tokens back
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.refresh_token) {
      await saveRefreshToken(tokens.refresh_token)
    }
  })

  return oauth2Client
}

/**
 * Generate the Google OAuth authorization URL
 */
export function getAuthUrl(): string {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CAL_CLIENT_ID,
    process.env.GOOGLE_CAL_CLIENT_SECRET,
    REDIRECT_URI
  )

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Force consent screen to always get refresh token
  })
}

/**
 * Exchange an authorization code for tokens and save the refresh token
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CAL_CLIENT_ID,
    process.env.GOOGLE_CAL_CLIENT_SECRET,
    REDIRECT_URI
  )

  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  if (tokens.refresh_token) {
    await saveRefreshToken(tokens.refresh_token)
  }

  return { oauth2Client, tokens }
}

/**
 * Save refresh token to both Supabase settings and .env file
 */
async function saveRefreshToken(refreshToken: string) {
  // 1. Save to Supabase
  const supabase = getAdminSupabase()
  await supabase
    .from("settings")
    .upsert({ key: "google_refresh_token", value: refreshToken }, { onConflict: "key" })

  // 2. Save to .env file
  try {
    const envPath = path.resolve("/data/workspace/.env")
    let envContent = fs.readFileSync(envPath, "utf-8")

    if (envContent.includes("GOOGLE_REFRESH_TOKEN=")) {
      envContent = envContent.replace(
        /GOOGLE_REFRESH_TOKEN=.*/,
        `GOOGLE_REFRESH_TOKEN=${refreshToken}`
      )
    } else {
      envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}`
    }

    fs.writeFileSync(envPath, envContent)
  } catch (err) {
    console.error("Failed to save refresh token to .env:", err)
  }
}

/**
 * List all calendars on the connected Google account
 */
export async function listCalendars() {
  const auth = await getAuthClient()
  const calendar = google.calendar({ version: "v3", auth })

  const { data } = await calendar.calendarList.list()
  return data.items || []
}

/**
 * Create a new Google Calendar event
 */
export async function createEvent(
  calendarId: string,
  event: {
    summary: string
    description?: string
    startTime: string // ISO string
    endTime: string   // ISO string
    attendees?: { email: string }[]
    conferenceData?: boolean // If true, creates Google Meet link
    location?: string
  }
) {
  const auth = await getAuthClient()
  const calendar = google.calendar({ version: "v3", auth })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestBody: Record<string, any> = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.startTime,
      timeZone: "America/New_York",
    },
    end: {
      dateTime: event.endTime,
      timeZone: "America/New_York",
    },
    attendees: event.attendees,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = {
    calendarId,
    requestBody,
  }

  if (event.conferenceData) {
    requestBody.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    }
    params.conferenceDataVersion = 1
  }

  const res = await calendar.events.insert(params)
  return res.data
}

/**
 * Get upcoming events from a calendar for the next N days
 */
export async function getUpcomingEvents(calendarId: string, days: number = 7) {
  const auth = await getAuthClient()
  const calendar = google.calendar({ version: "v3", auth })

  const now = new Date()
  const future = new Date()
  future.setDate(future.getDate() + days)

  const { data } = await calendar.events.list({
    calendarId,
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  })

  return data.items || []
}

/**
 * Delete a Google Calendar event
 */
export async function deleteEvent(calendarId: string, eventId: string) {
  const auth = await getAuthClient()
  const calendar = google.calendar({ version: "v3", auth })

  await calendar.events.delete({ calendarId, eventId })
}

/**
 * Check if a calendar with the given name exists; create it if not.
 * Returns the calendar ID.
 */
export async function getOrCreateCalendar(
  name: string,
  colorId?: string
): Promise<string> {
  const calendars = await listCalendars()
  const existing = calendars.find((c) => c.summary === name)

  if (existing?.id) {
    return existing.id
  }

  const auth = await getAuthClient()
  const calendar = google.calendar({ version: "v3", auth })

  const { data } = await calendar.calendars.insert({
    requestBody: {
      summary: name,
      timeZone: "America/New_York",
    },
  })

  // Set color if provided
  if (data.id && colorId) {
    await calendar.calendarList.patch({
      calendarId: data.id,
      requestBody: { colorId },
    })
  }

  return data.id!
}

/**
 * Setup the default HomeField Hub and Dr. Squeegee calendars on first connect.
 * Saves calendar IDs to Supabase settings.
 */
export async function setupDefaultCalendars() {
  const supabase = getAdminSupabase()

  // Color IDs: 1=Lavender, 2=Sage, 3=Grape, 4=Flamingo, 5=Banana, 6=Tangerine, 7=Peacock(blue), 8=Graphite, 9=Blueberry(blue), 10=Basil(green), 11=Tomato
  const homeFieldCalId = await getOrCreateCalendar("HomeField Hub", "9") // Blueberry (blue)
  const squeegeeCalId = await getOrCreateCalendar("Dr. Squeegee", "10") // Basil (green)

  // Save to Supabase settings
  await supabase.from("settings").upsert([
    { key: "google_calendar_homefield_id", value: homeFieldCalId },
    { key: "google_calendar_squeegee_id", value: squeegeeCalId },
  ], { onConflict: "key" })

  return { homeFieldCalId, squeegeeCalId }
}

/**
 * Get a saved calendar ID from Supabase settings
 */
export async function getSavedCalendarId(key: string): Promise<string | null> {
  const supabase = getAdminSupabase()
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .single()

  return (data?.value as string) || null
}

/**
 * Check if Google Calendar is connected (has a valid refresh token)
 */
export async function isCalendarConnected(): Promise<boolean> {
  if (process.env.GOOGLE_REFRESH_TOKEN) return true

  const supabase = getAdminSupabase()
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "google_refresh_token")
    .single()

  return !!(data?.value)
}

/**
 * Get the connected Google account info
 */
export async function getConnectedAccountInfo() {
  try {
    const auth = await getAuthClient()
    const oauth2 = google.oauth2({ version: "v2", auth })
    const { data } = await oauth2.userinfo.get()
    return data
  } catch {
    return null
  }
}

/**
 * Create a demo booking event on the HomeField Hub calendar
 */
export async function createDemoBookingEvent(booking: {
  clientName: string
  phone: string
  company?: string
  email?: string
  notes?: string
  startTime: string
  endTime: string
  meetingLink?: string
}): Promise<string | null> {
  try {
    const calendarId = await getSavedCalendarId("google_calendar_homefield_id")
    if (!calendarId) {
      console.warn("HomeField Hub calendar ID not found in settings")
      return null
    }

    const description = [
      `Client: ${booking.clientName}`,
      `Phone: ${booking.phone}`,
      booking.company ? `Company: ${booking.company}` : null,
      booking.email ? `Email: ${booking.email}` : null,
      booking.meetingLink ? `Meeting Link: ${booking.meetingLink}` : null,
      booking.notes ? `\nNotes: ${booking.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    const event = await createEvent(calendarId, {
      summary: `Demo Call - ${booking.clientName}${booking.company ? ` (${booking.company})` : ""}`,
      description,
      startTime: booking.startTime,
      endTime: booking.endTime,
      conferenceData: true,
      attendees: booking.email ? [{ email: booking.email }] : undefined,
    })

    return event.id || null
  } catch (err) {
    console.error("Failed to create demo booking event:", err)
    return null
  }
}
