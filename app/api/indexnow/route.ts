import { NextRequest, NextResponse } from "next/server"

const INDEXNOW_KEY = "31ff43803a3eef43367ec5347d88d88d"
const HOST = "www.drsqueegeeclt.com"
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`

/**
 * POST /api/indexnow — Ping Bing (and other IndexNow engines) about new/updated URLs.
 *
 * Body: { urls: string[] }
 * Example: { "urls": ["/blog/pressure-washing-tips", "/about"] }
 *
 * Can be called from n8n, a Supabase webhook, or manually via curl.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const expectedToken = process.env.INDEXNOW_AUTH_TOKEN

  // Simple bearer auth to prevent abuse (optional — skip if no env var set)
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { urls?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const urls = body.urls
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "Body must include { urls: [\"/path1\", \"/path2\"] }" },
      { status: 400 }
    )
  }

  // Normalize paths to full URLs
  const fullUrls = urls.map((u) =>
    u.startsWith("http") ? u : `https://${HOST}${u.startsWith("/") ? u : `/${u}`}`
  )

  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: fullUrls,
  }

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    })

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      submitted: fullUrls.length,
      urls: fullUrls,
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach IndexNow API", detail: String(err) },
      { status: 502 }
    )
  }
}

/** GET /api/indexnow — Health check / info */
export function GET() {
  return NextResponse.json({
    service: "IndexNow",
    host: HOST,
    keyLocation: KEY_LOCATION,
    usage: "POST { urls: [\"/blog/my-post\"] } to ping search engines",
  })
}
