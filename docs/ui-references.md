# CRM UI references — mined 2026-07-31

Source: Mobbin via `mobbin-ui-reference` skill (v6). Platform `web`, patterns
`Dashboard` / `Kanban Board` / `Charts`, elements `Side Navigation` / `Table`.

**Brand read (the filter used):** target is the `/crm` surface of `dr-squeegee`.
Palette from `lib/squeegee/brand.ts` — one accent (teal `#2D8C6F`), near-black
grounds (`#0A0A0A` / `#111111` / `#1A1A1A`), border `#242424`, brick red
`#B8453A` for destructive only. Type pairing Oswald (display) + Outfit (body).
So: **dark base, ONE accent, true-neutral greys.** References were judged in
greyscale — we take structure, never color.

---

## Accepted

### 1. Midday — app shell · `61a8b10b-37a1-45cc-8e03-7099a8889cc3`
**Nails:** an ~88px **icon-only rail** instead of a 224px labeled sidebar. Eleven
destinations with zero text, global "Find anything…" search owning the top bar.
**Took:** the rail width + icon-only grammar + command palette as primary nav.
**Left:** its light ground and serif-on-white editorial voice.

### 2. Midday — invoices table · `2b31bc0d-99cb-4925-8fb8-20f51bb20aee`
**Nails:** three things our dashboard does wrong. (a) Stat tiles sit **above** the
table as context, not as a separate dashboard page. (b) Each tile is `label →
big number → inline qualifier` ("$417 · across 2 accounts") — no icon, no
sparkline, no chrome. (c) Badges are **desaturated** (grey Unpaid, pale blue
Scheduled, pale green Paid) so the table reads as one surface.
**Took:** tile anatomy, badge desaturation, search+filter row above the table.
**Left:** the pastel badge hues — ours collapse to one accent + neutral ramp.

### 3. Stripe — transactions · `1bbafee3-44a6-4a27-81d2-dfdab7388258`
**Nails:** **filter tabs that ARE the stat tiles** — `All 6 / Succeeded 1 /
Refunded 0 / Failed 3` as one segmented row where each segment carries its own
count and the selected one takes the accent. One control does counting and
filtering. Also: `+ Date and time` `+ Amount` chip filters, and a plain
"6 results" footer instead of pagination furniture.
**Took:** the count-tabs pattern — this replaces our 5-hue status badge grid on
`/crm/jobs` outright. Plus the chip filter row.
**Left:** its green-check/red-X badges (multi-hue again) and its column density.

### 4. Twenty — companies board · `b4ca148d-0555-4928-877c-8f2ee3115856`
**Nails:** (a) nav grouped under quiet section labels — `Workspace` / `Other` —
which is exactly the fix for our flat 12-item list once modules land. (b) The
record card: `icon → label → value` rows where **empty fields stay visible but
greyed** ("Account Owner", "Employees"), so the card shape is stable and missing
data is legible as missing.
**Took:** nav section grouping; the greyed-empty-field card for job/client detail.
**Left:** its six pastel column headers — the exact multi-hue trap we're removing.

---

## Rejected

| App | Why |
|---|---|
| Airtable, Asana, ClickUp | Badge-heavy and dense; standing rejects in the skill. |
| Amplitude, Quicken, Monarch | Busy multi-hue chart dashboards; hierarchy carried by color, dies in one-accent. |
| Etsy, Eventbrite, Zapier, Linktree | Generic marketing-grade SaaS shells; "typical" is not "good." |
| Loom, 1Password, Whereby, Loops | Too thin — not enough structure to learn from. |
| Sprout Social, Dovetail, LangChain, Grok | Chrome over content. |

## Notes / dead ends
- `screen_elements: ["Map"]` on iOS returns **zero** results — Mobbin has no map
  element in its taxonomy. Field/knock map design has no Mobbin reference; it
  comes from the real product (`doors/components/territory-map*.tsx`, OSM tiles
  with `$` pins per house rules).
- Inspiration only. Never traced. Demo/product screenshots must come from the
  real product, never invented.
