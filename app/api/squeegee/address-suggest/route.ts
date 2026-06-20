import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

// Charlotte, NC bias center
const CLT = { lat: 35.2271, lng: -80.8431 }

interface GooglePrediction {
  placePrediction?: { text?: { text?: string } }
}
interface PhotonFeature {
  properties: Record<string, string>
}

/**
 * Address autocomplete proxy. Keeps the Google Places key server-side
 * (the repo is public). Uses Google Places API (New) when
 * GOOGLE_PLACES_API_KEY is set, otherwise falls back to free Photon.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim()
  if (q.length < 3) return NextResponse.json({ suggestions: [] })

  const key = process.env.GOOGLE_PLACES_API_KEY
  if (key) {
    try {
      const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
        body: JSON.stringify({
          input: q,
          includedRegionCodes: ["us"],
          locationBias: {
            circle: { center: { latitude: CLT.lat, longitude: CLT.lng }, radius: 50000 },
          },
        }),
      })
      if (r.ok) {
        const d = (await r.json()) as { suggestions?: GooglePrediction[] }
        const suggestions = (d.suggestions ?? [])
          .map((s) => s.placePrediction?.text?.text)
          .filter((s): s is string => Boolean(s))
        return NextResponse.json({ suggestions, source: "google" })
      }
    } catch {
      // fall through to Photon
    }
  }

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lat=${CLT.lat}&lon=${CLT.lng}&lang=en`
    const r = await fetch(url)
    const d = (await r.json()) as { features?: PhotonFeature[] }
    const suggestions = (d.features ?? [])
      .map((f) => {
        const p = f.properties
        const street = [p.housenumber, p.street].filter(Boolean).join(" ")
        return [street, p.city, p.state, p.postcode].filter(Boolean).join(", ")
      })
      .filter((s) => s.length > 0)
    return NextResponse.json({ suggestions: Array.from(new Set(suggestions)), source: "photon" })
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}
