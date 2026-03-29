import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function formatICSDate(dateStr: string, timeStr: string | null): string {
  // dateStr: "2026-03-15", timeStr: "14:30" or null
  const [year, month, day] = dateStr.split('-')
  if (timeStr) {
    const [hour, minute] = timeStr.split(':')
    return `${year}${month}${day}T${hour}${minute}00`
  }
  return `${year}${month}${day}T090000` // Default 9 AM
}

function addHours(dateStr: string, timeStr: string | null, hours: number): string {
  const date = new Date(`${dateStr}T${timeStr || '09:00'}:00`)
  date.setHours(date.getHours() + hours)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}${m}${d}T${h}${min}00`
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = getAdmin()

  const { data: job, error } = await supabase
    .from('squeegee_jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (!job.appointment_date) {
    return NextResponse.json({ error: 'No appointment date set' }, { status: 400 })
  }

  const dtStart = formatICSDate(job.appointment_date, job.appointment_time)
  const dtEnd = addHours(job.appointment_date, job.appointment_time, 2) // 2 hour block
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`

  const serviceName = job.service_type && job.service_type !== 'Pending Quote'
    ? job.service_type
    : 'Service'

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dr. Squeegee//CRM//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@drsqueegeeclt.com`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=America/New_York:${dtStart}`,
    `DTEND;TZID=America/New_York:${dtEnd}`,
    `SUMMARY:${serviceName} - ${job.client_name}`,
    `LOCATION:${job.address}`,
    `DESCRIPTION:Client: ${job.client_name}\\nPhone: ${job.client_phone || 'N/A'}\\nService: ${serviceName}\\nPrice: $${job.price != null ? Number(job.price).toFixed(2) : 'TBD'}\\n\\nDirections: ${mapsUrl}`,
    `URL:${mapsUrl}`,
    'STATUS:CONFIRMED',
    `ORGANIZER;CN=Dr. Squeegee:mailto:anternetai@gmail.com`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${serviceName} for ${job.client_name} in 30 minutes`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="dr-squeegee-${job.appointment_date}.ics"`,
    },
  })
}
