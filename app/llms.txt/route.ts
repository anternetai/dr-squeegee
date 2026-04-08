import { NextResponse } from "next/server"

const LLMS_TXT = `# Dr. Squeegee

> Professional pressure washing and exterior cleaning in Charlotte, NC. House washing, driveway cleaning, window cleaning, surface cleaning, pool decks, and pavers. Licensed, insured, 5-star rated. Serving Charlotte, Huntersville, Matthews, Mint Hill, Ballantyne, South End, and the greater Mecklenburg County area.

## About
- [About Dr. Squeegee](https://www.drsqueegeeclt.com/about.md): Our story, services, and service area
- [Get a Quote](https://www.drsqueegeeclt.com/get-quote.md): Services, pricing approach, and how to request a free quote

## Services
- House Washing — Soft wash of exterior siding, eaves, and trim
- Window Cleaning — Streak-free interior and exterior window cleaning
- Surface Cleaning — High-pressure cleaning of walkways and patios
- Driveway — Full driveway pressure wash — oil stains, tire marks, buildup
- Pool Deck — Pressure wash and surface treatment of pool deck
- Pavers — Paver pressure wash with joint sand preservation

## Blog
- [Blog Index](https://www.drsqueegeeclt.com/blog.md): Tips, guides, and pressure washing insights

## Contact
- Phone: (980) 242-8048
- Address: 8623 Longnor St, Charlotte, NC 28214
- Website: https://www.drsqueegeeclt.com

## Legal
- [Privacy Policy](https://www.drsqueegeeclt.com/privacy.md)
`

export function GET() {
  return new NextResponse(LLMS_TXT, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
