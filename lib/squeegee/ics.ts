// Customer-facing calendar helpers for the /appt page. Unlike the internal
// jobs/[id]/calendar route, this omits price/phone/notes — the customer just
// needs their appointment: service, when, where, directions.

export interface ApptEvent {
  service: string
  date: string // YYYY-MM-DD
  time: string | null // HH:MM[:SS] or null
  address: string
}

function icsStamp(date: string, time: string | null): string {
  const [y, m, d] = date.split("-")
  const [h = "09", min = "00"] = (time ?? "09:00").split(":")
  return `${y}${m}${d}T${h.padStart(2, "0")}${min.padStart(2, "0")}00`
}

function plusHours(date: string, time: string | null, hours: number): string {
  const dt = new Date(`${date}T${time || "09:00"}:00`)
  dt.setHours(dt.getHours() + hours)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${dt.getFullYear()}${p(dt.getMonth() + 1)}${p(dt.getDate())}T${p(dt.getHours())}${p(dt.getMinutes())}00`
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

export function buildCustomerIcs(e: ApptEvent): string {
  const start = icsStamp(e.date, e.time)
  const end = plusHours(e.date, e.time, 2)
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
  const service = e.service && e.service !== "Pending Quote" ? e.service : "Service"
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dr. Squeegee//Appointment//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${start}-${encodeURIComponent(e.address).slice(0, 12)}@drsqueegeeclt.com`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=America/New_York:${start}`,
    `DTEND;TZID=America/New_York:${end}`,
    `SUMMARY:Dr. Squeegee - ${service}`,
    `LOCATION:${e.address}`,
    `DESCRIPTION:Your Dr. Squeegee ${service.toLowerCase()} appointment.\\n\\nDirections: ${mapsUrl(e.address)}`,
    `URL:${mapsUrl(e.address)}`,
    "STATUS:CONFIRMED",
    "ORGANIZER;CN=Dr. Squeegee:mailto:care@drsqueegeeclt.com",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:Dr. Squeegee ${service.toLowerCase()} in 2 hours`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}

// Google Calendar "add event" template URL (no login friction, universal).
export function googleCalUrl(e: ApptEvent): string {
  const start = icsStamp(e.date, e.time)
  const end = plusHours(e.date, e.time, 2)
  const service = e.service && e.service !== "Pending Quote" ? e.service : "Service"
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Dr. Squeegee - ${service}`,
    dates: `${start}/${end}`,
    ctz: "America/New_York",
    location: e.address,
    details: `Your Dr. Squeegee ${service.toLowerCase()} appointment. Directions: ${mapsUrl(e.address)}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
