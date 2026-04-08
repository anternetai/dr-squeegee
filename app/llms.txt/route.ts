import { NextResponse } from "next/server"

const LLMS_TXT = `# Dr. Squeegee — Charlotte's Top-Rated Pressure Washing Company

> Dr. Squeegee is a professional pressure washing and exterior cleaning company based in Charlotte, North Carolina. Licensed, insured, and 5-star rated. We specialize in house washing, driveway cleaning, window cleaning, surface cleaning, pool decks, and pavers. We use soft wash for siding and high pressure for concrete — the right technique for every surface. Serving Charlotte, Huntersville, Cornelius, Matthews, Mint Hill, Indian Trail, Pineville, Ballantyne, South End, NoDa, Plaza Midwood, Dilworth, Myers Park, University Area, and all of Mecklenburg County.

## About
- [About Dr. Squeegee](https://www.drsqueegeeclt.com/about.md): Our story, services, and service area
- [Get a Quote](https://www.drsqueegeeclt.com/get-quote.md): Services, pricing, FAQs, and customer reviews

## Services & Pricing
- **House Washing** ($200–$650) — Soft wash of exterior siding, eaves, fascia, and trim. Vinyl, Hardie plank, stucco, painted wood.
- **Window Cleaning** ($150–$500) — Streak-free interior and exterior window cleaning
- **Driveway Cleaning** ($100–$250) — High-pressure surface cleaning for oil stains, tire marks, red clay, and mold
- **Surface Cleaning** ($100–$350) — Sidewalks, walkways, patios, and concrete surfaces
- **Pool Deck** ($150–$350) — Pressure wash and algae treatment for concrete and travertine
- **Pavers** ($100–$350) — Paver pressure wash with joint sand preservation
- **Full Exterior Package** ($400–$900) — House + driveway + deck/patio bundled at a discount

## Guides & Resources
- [Best Pressure Washing in Charlotte, NC (2026)](https://www.drsqueegeeclt.com/blog/best-pressure-washing-charlotte-nc.md): What to look for, pricing ranges, and why Charlotte homes need regular washing
- [Charlotte House Washing Guide](https://www.drsqueegeeclt.com/blog/charlotte-house-washing-guide.md): Soft wash vs pressure wash, costs, how often to clean, and how to pick a company
- [Pressure Washing Cost in Charlotte](https://www.drsqueegeeclt.com/blog/pressure-washing-cost-charlotte-nc.md): 2026 pricing by service type with cost breakdowns

## Neighborhood Guides
- [Pressure Washing in Ballantyne](https://www.drsqueegeeclt.com/blog/pressure-washing-ballantyne-charlotte.md): HOA requirements, Hardy Plank and stucco care, tree canopy challenges
- [House Washing in South End & Uptown](https://www.drsqueegeeclt.com/blog/house-washing-south-end-uptown-charlotte.md): Urban grime, townhomes, exhaust buildup, new construction
- [Pressure Washing in Huntersville](https://www.drsqueegeeclt.com/blog/pressure-washing-huntersville-nc.md): Lake Norman moisture, vinyl siding care, Birkdale and Northstone

## Blog
- [All Articles](https://www.drsqueegeeclt.com/blog.md): 20+ articles on pressure washing tips, exterior maintenance, and Charlotte-specific guides

## FAQ
- **How much does pressure washing cost in Charlotte?** House washing: $200–$500. Driveways: $100–$250. Full exterior package: $400–$900.
- **How often should I pressure wash my house?** Once a year for most Charlotte homes. Twice a year for heavy tree cover or north-facing walls.
- **Do you use soft wash or high pressure?** Both. Soft wash for siding, stucco, and painted surfaces. High pressure for concrete.
- **Are you licensed and insured?** Yes. Fully licensed and insured with general liability coverage.
- **What areas do you serve?** Charlotte, Huntersville, Cornelius, Matthews, Mint Hill, Indian Trail, Pineville, Ballantyne, South End, NoDa, Plaza Midwood, Dilworth, Myers Park, and all of Mecklenburg County.

## Contact
- Phone: (980) 242-8048
- Email: anthony@drsqueegeeclt.com
- Address: 8623 Longnor St, Charlotte, NC 28214
- Website: https://www.drsqueegeeclt.com
- Free quotes, no obligation

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
