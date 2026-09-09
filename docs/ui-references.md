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

---

# Crew Portal UI references — mined 2026-09-03

Mined from Mobbin 2026-09-03 via `mobbin-ui-reference` skill (v6), out-of-band through the
repo client (`mobbin-mcp` @ `86e281b`) because the MCP was down in-session. Companion to
`SPEC-CREW-PORTAL.md`.

**Target brand seam read first** (`lib/squeegee/brand.ts`), per skill step 1:

| Axis | Value |
|---|---|
| Base mode | **Dark always** (house rule) — `black #0A0A0A`, `panelDark #111111`, `border #242424` |
| Accent count | **One** — teal `#2D8C6F` / `tealDark #1F6B54`. `brickRed #B8453A` destructive only |
| Neutral temp | **True grey**, near-black. `mutedText #9CA3AF` |
| Type pairing | **Oswald** (condensed display) + **Outfit** (body) |

Shopping for **structure** — layout, density, hierarchy, how a status is presented. Explicitly
**not** for color. Every reference below is light-mode; all of them get recolored into the tokens
above. Each was judged on whether it survives greyscale, i.e. whether its hierarchy lives in
layout/weight/spacing rather than hue.

---

## The honest headline: Mobbin has no worker-side field apps

The closest real analogs to a crew portal — Jobber, ServiceTitan, Housecall Pro, Uber **Driver**,
DoorDash **Dasher**, Instacart **Shopper** — are **not in Mobbin's corpus**. It indexes consumer
apps. `quick_search` resolves "uber", "doordash", "instacart" to app IDs, but every one is the
consumer app, and named-app drill-down is dead anyway (below).

So there is no reference for the three things most specific to this build: **claiming a job from a
pool**, **a photo gate that blocks completion**, and **a per-job timer**. Those get designed from
the spec and the field-CRM research, not from a screenshot. Said plainly so nobody later mistakes
invention for reference.

What Mobbin *does* have that transfers: the **consumer delivery-tracking** grammar. That's the same
problem shape as our job status lifecycle — a small number of states, a person en route, an ETA,
and a plain-language restatement of "what's happening right now."

---

## Survivors

### 1. Glovo — order progress · `11d66eda-0aac-4f96-bdf0-8ef1d785ceb0`
`ios` · pattern `Progress` · kw `delivery`

The strongest structural match in the sweep, and it maps 1:1 onto our three field states.

- **Three-segment labeled bar** — `In progress · Pick up · Delivery`, current segment *partially*
  filled. Our `on_my_way → in_progress → complete` is also exactly three. Better fit than a 4-node
  rail, and the partial fill communicates "mid-step" without a spinner.
- **Only the changing verb is bold** — "The courier is **picking up** your order." The sentence is
  stable; the state is the bold word. Cheap, readable at a glance, survives greyscale.
- **ETA as a range** — `11:20 - 11:30`, not a single time. Use this for arrival windows on job cards
  and for the On-my-way ETA presets.
- **Person row with circular icon buttons** — name + role, call and chat as two circles, not
  full-width buttons. Reclaims vertical space our current `JobCard` spends on a 2-col Call/Text grid.

**Took:** three-segment bar, bold-the-verb sentence, ETA range, circular contact buttons.
**Left:** the orange ground, the courier illustration, and the "Need to fill the fridge?" upsell
carousel wedged between status and detail — that's exactly the chrome-over-content our house rules
reject.

### 2. DoorDash — order tracking · `aa691d53-16af-45b2-b203-20d73eac00dc`
`ios` · patterns `Map / Timer & Clock / Progress` · kw `delivery`

- **Card floats over the map; the map is context, the card carries the state.** Directly applicable
  to the job screen: address/directions is ambient, the status button and current state are the
  content. Avoids the trap of making the map the feature.
- **Four-node icon rail** with a filled connector, each node an icon not a label.
- **Plain-English restatement under the rail** — "McDonald's is preparing your order." Same
  principle as Glovo, different execution.
- **"Arrives between 11:51 PM–12:01 AM"** — range again. Two independent products landing on the
  same choice is a strong signal.

**Took:** card-over-map composition, icon rail with filled connector, the restatement line.
**Left:** four nodes (we have three states, not four), and the DoubleDash upsell sheet stacked under
the status card.

### 3. Uber Eats — empty state · `4686bd3e-ebb5-4927-9f8d-1d4bb18d9f1b`
`ios` · pattern `Empty States` · kw `orders`

**Weak survivor — copy skeleton only.** Included because the open board's empty state is a screen the
crew will hit often, and getting its wording right matters more than its art.

- Headline states **the fix**, not the absence ("Add items to start a basket").
- Subtext says **when it will change** ("Once you have added items… your basket will appear here").
- **One** primary pill action. No secondary competing for attention.

For us: *"No open jobs right now"* / *"When Anthony schedules a job it shows up here — you'll get a
notification."* / one button back to Today.

**Took:** the three-part copy skeleton.
**Left:** the illustration. Generic vector-blob-and-cart is precisely the AI-slop register the house
rules forbid; our empty state gets type and space, no mascot.

---

## Rejected

**TaskRabbit** — all 5 hits (`f9cebb44`, `15bfa950`, `2612deea`, `125fcffc`, `8b6d8b65`).
Looked promising as the only gig-work surface in the corpus. It is not: these are the **customer**
side ("What do you need help with?", a service-category grid). The `shift` keyword matched the
service category **"Lift & Shift"** — an OCR false positive, not a work shift. A reminder that
`screen_keywords` matches pixels, not meaning, and that you have to open the image to find out.

**`Home` + kw `today`** (155 hits — Revolut, Opal, Headspace, WHOOP, Bevel) — all wellness/finance
dashboards. Chart-led daily summaries, no task grammar. Wrong problem shape.

**`Scheduling`** (630 — Swiggy, Uber, Gojek, Instagram, Apple Health) — date/time *pickers*, i.e. the
act of choosing a slot. We need to *display* an assigned day, which is a different surface.

---

## API state as of 2026-09-03 (corrects the skill's 7/31 notes)

| Route / tool | State |
|---|---|
| `searchScreens` / `searchFlows` | ✅ works |
| `searchApps` | ✅ works — **was** failing schema validation until `86e281b` relaxed `appResultSchema` |
| `quick_search` (`autocompleteSearch`) | ✅ **works again** — skill had it documented as 404-dead |
| `getSearchableApps` → `getAppPage` | ❌ still 404 `/api/searchable-apps/{platform}` — **named-app drill-down remains dead**, cross-app pattern sweeps are still the only path |
| `extract_colors` | ⚠️ degraded — sharp's native binary won't dlopen on this machine; now fails alone instead of killing the server |

**Newly validated `screenPatterns` (iOS, with counts):** `Home` 4636 · `Empty States` 3283 ·
`Confirmation` 2667 · `Maps`/`Map` 2097 · `Dashboard` 1598 · `Checkout` 1564 · `Progress` 1546 ·
`Settings` 1330 · `Calendar` 950 · `Notifications` 894 · `Scheduling`/`Schedule` 630.

**Return 0 on iOS — do not use:** `Checklist`, `Tasks`, `Camera`, `Upload`, `Booking`, `Timer`,
`Details`, `Profile`, `Activity`, `Orders`, `Delivery`, `Tracking`, `Status`, `Onboarding`,
`Location`, `Navigation`, `Job`, `Work`, `Time Tracking`, `Photos`, `Gallery`, `Media`.

**New gotcha:** labels that appear inside a row's own `screenPatterns[]` are **not** all valid as
*filter* inputs. `Timer & Clock`, `Goal & Task`, `Timeline & History` and singular `Empty State` all
come back in row data but throw a schema-validation error when passed as `screenPatterns` — the API
returns an envelope with no `value`. Ampersand-containing names appear to be display labels only.

**Image fetching:** raw `ujasntkfphywizsdaapi.supabase.co/storage/...` URLs return
`404 NoSuchBucket`. Images must go through `client.fetchScreenImage()`, which rewrites to the
Bytescale CDN. They arrive as **webp** regardless of the `.png` in the URL — save them `.webp` or
they won't open.

---
