# UI references — crew portal (`/team`)

Provenance for design choices, per the `mobbin-ui-reference` skill. References are
structure only; every borrowed pattern is recolored into the crew portal's own tokens
(ground `#0A0A0A`, surface `#111111`, line `#242424`, teal `#2D8C6F` / `#4FC49E`,
amber `#E0A458`). Mobbin has no worker-side field-service apps, so these are consumer
"today" surfaces whose grammar transfers.

## 2026-09-17 — bottom tab bar + week strip

Sweep: iOS · pattern `Home` · element `Tab Bar` · keyword `today` (8 results).

**Kept**
- **Noom — Home** (`726a894d-7bbb-4269-9e97-3007507cd4e4`): three *labelled* tabs, active
  = accent icon + label; a Mon–Sun strip at the top with today lit and progress marks
  per day. Took: the three-tab labelled bar and the week strip with a per-day mark.
  Left: its light palette, serif headings, the calorie meter.
- **Luma — Home** (`4e0f5ef3-de35-450a-b8b8-f8e7ac192e6a`): list rows with a clock line
  and a pin line, status pill on the row. Took: time-then-address meta stacking on job
  cards (already close in v2; today's card now leads with the arrival window). Left:
  cover images, the floating pill bar.

**Rejected**
- **Mesh — Home**: icon-only floating pill bar. No labels is wrong for a tech in direct
  sun who has never seen a tutorial.
- Lifesum / Tonal / Fi / BlaBlaCar / Future Pro: generic dashboards or map-first homes;
  nothing structural beyond what Noom/Luma already give.

**House rules applied:** dark always · labels on every tab · the bar stays off the job
screen (its bottom edge belongs to the one big action button) and off login/join.
