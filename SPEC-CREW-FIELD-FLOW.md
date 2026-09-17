# Crew field flow v3 — Arrived step, owner-confirmed customer texts, per-service photo gate, contact toggle, install prompt, crew pay + crew profitability

_Spec of record, 2026-09-16. Answers from Anthony's interview: **add an Arrived step** · **customer is texted only after Anthony confirms** · **he confirms by replying YES to the text** · **hard photo gate per service** · **crew pay on the admin side, and a way to see if a crew member makes or costs him money**. Everything below is decided; builders do not re-open decisions._

## 0. Why

The crew portal v2 is testable (PIN fix shipped `c1bd86f`) and Anthony's first walk-through produced this list:

1. "Earned this week" shows nothing because **`squeegee_jobs.crew_pay` is never set anywhere** — the CRM has no input for it.
2. The "Add to Home Screen" nudge is a quiet card on `/team/me`; he wants a bold, urgent prompt they act on immediately. (Bonus bug found: `/team` uses `crm-manifest.json`, whose `start_url` is `/crm` — an installed crew app would open the CRM.)
3. He wants a per-employee switch for whether the crew can call/text the customer.
4. On the way / Arrived should text **him**; the customer only hears from the business after **he replies YES**. The crew's screen looks the same as today.
5. Start job should ask "Did you take before pictures?" with a camera that stays open for multiple shots, **per service**, and only then light up START JOB. Same shape for after photos before Done.
6. He wants to know whether a given crew member is making or costing him money ("$525 driveway, 4 hours solo; with him it would have taken the same 4 hours").

## 1. Shared contract (already on master — builders import, never redefine)

`lib/squeegee/field.ts` (pure, unit-tested; re-exported from `lib/squeegee/crew.ts` for existing imports):

```ts
FIELD_STEPS = [
  { key: "on_my_way",   label: "On my way", done: "On the way" },
  { key: "arrived",     label: "Arrived",   done: "Arrived" },
  { key: "in_progress", label: "Start job", done: "Working" },
  { key: "complete",    label: "Done",      done: "Complete" },
]
type FieldStatus = "on_my_way" | "arrived" | "in_progress"
nextStep(job)             // null → on_my_way → arrived → in_progress → complete → null
stepReached(job, key)     // for the step bar
fieldStateSentence(job)   // adds "You have arrived."
serviceList(service_type) // "House Wash, Windows, Windows" → ["House Wash","Windows"]; "" → ["Job"]
photoGateReason(kind: "before"|"after", services, photos: {kind, service}[]) : string | null
  // null when every service has ≥1 photo of that kind. A photo whose service is
  // null is a WILDCARD (legacy rows) and satisfies every service.
  // One missing:  "Add a before photo of the Windows first"
  // Several:      "Before photos still needed: Windows, Driveway"
missingServices(kind, services, photos): string[]
```

`lib/squeegee/crew.ts`: `jobPhotos(supabase, jobId)` loads `{kind, service}` rows for the gate. The old `photoCounts` / count-based `photoGateReason(counts)` are gone.

`squeegee_jobs.field_status` values: `null | on_my_way | arrived | in_progress`. Pipeline `status` is untouched.

## 2. Schema (migration `supabase/migrations/20260916_crew_field_flow.sql`, applied to prod by the orchestrator)

- `squeegee_employees.can_contact_customers boolean not null default true`
- `squeegee_job_photos.service text` (null = legacy/wildcard)
- `squeegee_crew_alerts` — service-role only (RLS on, zero policies, revoke anon/authenticated):
  `id uuid pk`, `job_id → squeegee_jobs`, `employee_id → squeegee_employees`, `kind text check in ('on_my_way','arrived')`, `eta_minutes int`, `status text check in ('pending','confirmed','declined','expired') default 'pending'`, `owner_sms_id uuid`, `customer_sms_id uuid`, `created_at`, `acted_at`.
- `squeegee_settings` already exists (F0): `key text, value jsonb, updated_at`. The solo baseline lives there as key `solo_revenue_per_hour` with a numeric JSON value — read/write it through `lib/squeegee/settings.ts` helpers, not raw queries. See 3.8.

## 3. Server + CRM (builder B — "server")

### 3.1 Status route `POST /api/team/jobs/[id]/status`
- Accepts `to ∈ {on_my_way, arrived, in_progress}`; still only the next legal step (409 otherwise).
- `on_my_way` → open `drive` segment. `arrived` → `closeOpenSegment` (standing in the driveway is neither driving nor working). `in_progress` → open `work`.
- **`in_progress` enforces the BEFORE gate server-side**: `photoGateReason("before", serviceList(job.service_type), await jobPhotos(...))` → 400 `{ error, missing }`.
- `on_my_way` and `arrived` **no longer text the customer.** They:
  1. mark any `pending` alert for this job `expired`,
  2. insert a `squeegee_crew_alerts` row (`pending`, eta for on_my_way),
  3. text Anthony via `sendSms({ phone: process.env.OWNER_PHONE ?? "+19802428048", kind: "crew_alert_owner", relatedType: "crew_alert", relatedId: alert.id, force: true, body })` — through `sendSms` so test-mode/logging/opt-out all apply; store the returned sms id on `owner_sms_id` when `SendResult` exposes one (read `lib/squeegee/sms.ts` — if it doesn't, add `id` to `SendResult`).
  Bodies (no links; plain GSM punctuation only — no curly quotes, no em dashes):
  - on_my_way: `Crew: {crewFirst} is on the way to {client_name}, {address} (~{eta} min). Reply YES to text {custFirst} we're on the way, NO to skip.`
  - arrived: `Crew: {crewFirst} arrived at {client_name}, {address}. Reply YES to text {custFirst} we've arrived, NO to skip.`
- Response stays `{ ok, field_status, notified }` (`notified` = owner alert sent).

### 3.2 Inbound YES/NO — `lib/squeegee/parser-handler.ts` `handleParserMessage`
- Before the SEND/CANCEL branch: keyword `YES|Y|NO|N` → newest `pending` crew alert created in the last 12 h. None → return `false` (fall through; a stray YES then hits the opt-in path harmlessly).
- YES → status `confirmed`, `acted_at`, then send the customer text, deduped per (job, kind) the way the old `smsOnMyWayOnce` did: `on_my_way` → `smsTemplates.crewOnMyWay(name, eta)`; `arrived` → new `smsTemplates.crewArrived(name)`: `Dr. Squeegee: Hi {first}, we've arrived and are getting started. Questions? Call {CALL}. Reply STOP to opt out.` Store `customer_sms_id`. Reply to Anthony `Sent to {custFirst}.` (or `Couldn't text {custFirst}: {reason}.` when consent/opt-out/test-mode blocked it — read the SendResult).
- NO → `declined`, reply `Skipped.`
- Rename `smsOnMyWayOnce` → `smsCrewEventOnce({ jobId, kind, name, phone, etaMinutes })` in `sms-events.ts`; nothing else calls the old name.

### 3.3 Photos route `POST /api/team/jobs/[id]/photos`
- New form field `service` (required; must be in `serviceList(job.service_type)` case-insensitively, stored with the job's spelling; else 400 `{ error, services }`). Returned in `photo: { id, kind, service, url }`.

### 3.4 Complete route — AFTER gate per service via `photoGateReason("after", …)`; 400 `{ error, missing }`.

### 3.5 Crew job page `app/team/jobs/[id]/page.tsx`
- Select `service` on photos → `JobPhoto.service: string | null`.
- Add `can_contact_customers` to `EMPLOYEE_COLS` + `SqueegeeEmployee` in `employee-auth.ts`; when false pass `client_phone: null` into `JobView` so the number never reaches the client.
- Pass `services={serviceList(job.service_type)}`.
- (Builder A owns `job-view.tsx`; you only change the page's props. Add the `services` prop and `JobPhoto.service` to the `JobView` signature in `job-view.tsx` in the MINIMAL way — extend the interfaces and accept the prop — so both branches merge cleanly; do not touch its JSX.)

### 3.6 CRM
- `PATCH /api/crm/employees/[id]`: allow `can_contact_customers` (boolean). Editor Details card: a toggle row **"Can call/text customers"** — tappable card with an amber selected state, not a bare checkbox (house rule).
- `PATCH /api/squeegee/jobs/[id]`: add `crew_pay` to `JOB_EDITABLE` (coerce: number ≥ 0, or null). `components/squeegee/job-assign.tsx` gains a **Crew pay $** input beside the assignee (saves on blur via the PATCH; shows "saved"). The CRM job page passes `crewPay`.
- `JobCrewWork` timeline: add the `arrived` row; render the job's crew alerts (`kind`, `status`, `eta_minutes`, `created_at`, `acted_at`) as "On the way · waiting on your YES" / "On the way · you confirmed 9:02 AM" / "· skipped" / "· expired". The CRM job page loads them (service-role).
- `/crm/team/[id]/page.tsx` selects `can_contact_customers` and passes it to the editor.

### 3.7 Tests
Add pure helpers to `lib/squeegee/field.ts` + `field.test.ts` only when you need them (e.g. the keyword parser for YES/NO can be a pure `crewReplyKeyword(body)`).

### 3.8 Crew profitability — `/crm/team/[id]` "Worth it?" panel (server-computed, client renders numbers)
For this employee's **completed** jobs with `completed_at` in the window (default: all time; chips for 30 days / 90 days / all — a `?window=` search param is fine):
- `jobs` count · `revenue` = Σ `price` · `crew_pay` = Σ `crew_pay` (null counts 0, but show "n of m jobs have crew pay set") · `hours` = Σ this employee's `work` segments on those jobs (their clock) · `revenue_per_hour` = revenue / hours · `net_per_hour` = (revenue − crew_pay) / hours · `crew_share` = crew_pay / revenue.
- Baseline: `squeegee_settings.solo_revenue_per_hour` (Anthony's own $/hr working alone). Add the key to `SETTINGS_KEYS` / `CrmSettings` / `DEFAULT_SETTINGS` (default `null`) in `lib/squeegee/settings.ts` and read it with `loadSettings`; the panel has an input + Save that calls a CRM-gated route (reuse the existing settings route if one exists — `grep -rn saveSetting app/api` — else add `PATCH /api/crm/settings` accepting only known keys via `saveSetting`). When set, the panel's verdict line reads one of:
  - `With {first}: ${net}/hr after pay vs your solo ${solo}/hr → making you ${diff}/hr` (teal)
  - `… → costing you ${diff}/hr` (amber)
  - When unset: `Enter what you make per hour working alone to see if {first} pays for themselves.`
- Empty state when no completed jobs with time data: say so plainly.
- This panel reads `price` — it is the OWNER's surface. Never let any of it into a `/team` select.

## 4. Crew UI (builder A — "crew-ui"), all under `app/team/**` + `public/team-manifest.json`

### 4.1 Job screen `app/team/jobs/[id]/job-view.tsx`
- Props gain `services: string[]`; `JobPhoto` gains `service: string | null`. Gate = `photoGateReason(kind, services, photos)` from `@/lib/squeegee/crew`.
- StepBar = 4 segments from `FIELD_STEPS` using `stepReached`. Arrived is a plain tap (no ETA sheet). The on-my-way helper copy stays exactly `We'll text {first} that you're on the way.`
- **Start job tap** → centered modal (dim backdrop, max-w-sm, big type): **"Did you take BEFORE pictures?"** — buttons **Yes** / **No**.
  - Yes → if the before gate is null → `advance("in_progress")`; else the modal switches to "Still need before photos of: Windows, Driveway" with **Take them now**.
  - No / Take them now → open **CameraSheet** for `before`.
  - When the gate becomes satisfied while the sheet is open, closing it lands on the job screen with the **START JOB button lit**: solid teal, pulsing ring (`animate-pulse` ring or a keyframe), label `Start job — photos done ✓`. Until then the button reads the gate reason (on the button, as today) and is disabled.
- **Done tap** → same modal for **AFTER** pictures, same mechanics, then the existing note + Confirm done.
- **CameraSheet** (new client component, `app/team/jobs/[id]/camera-sheet.tsx`):
  - Full-screen overlay. Rear camera via `getUserMedia({ video: { facingMode: { ideal: "environment" } } })` into a `<video playsInline muted autoPlay>`; capture to canvas → JPEG (reuse `compress()` on the blob, or capture at ≤1600px directly), upload immediately with `service` + `kind`; the sheet **stays open** after every shot.
  - Header: kind + current service + progress `Before · Windows · 2 of 3 services`. A row of service chips shows a check when that service has ≥1 photo. Thumbnail strip of this service's shots (tap × to delete via `DELETE /api/team/photos/[id]`).
  - Buttons: big shutter; **Next service →** (or **Done with {service}** on the last); after the last service: prompt **"Need to add any more?"** — **Add more** (back to chips) / **I'm done** (close). If any service still has 0, "I'm done" is replaced by **Still need: …** and stays on the sheet.
  - Uploads: sequential queue with a `Saving 2…` badge; a failed upload keeps the thumbnail with a **Retry**; never lose a shot silently.
  - Fallback when `getUserMedia` is unavailable or denied: the same sheet drives a hidden `<input type="file" accept="image/*" capture="environment" multiple>` per service.
  - Stop every track on close/unmount.
- PhotoRail: grouped **per service** under Before / After (header `Before · Windows`), each group has its own Add (opens the CameraSheet on that service), "Required" chip per empty group.
- Call/Text buttons render only when `client_phone` is present (server nulls it when the employee may not contact customers). No copy about permissions.
- `team-view.tsx` CHIP map gains `arrived: "Arrived"`.

### 4.2 Install prompt — `app/team/team-view.tsx` (+ small `app/team/install-sheet.tsx`)
- Detect standalone (`display-mode: standalone` or `navigator.standalone`). When NOT installed, on every `/team` visit show a **bottom sheet** that reads as urgent: headline `Install this app now`, sub `Job alerts don't work in the browser. It takes 10 seconds.`
  - iOS: numbered steps with the Share and Add-to-Home-Screen icons, big.
  - Android/Chrome: listen for `beforeinstallprompt`; show a one-tap **Install** button that calls `prompt()`; otherwise the ⋮ → "Add to Home screen" steps.
  - **Not now** hides it for this session only (`sessionStorage`); it returns next open until installed. No permanent dismiss.
- `public/team-manifest.json`: name `Dr. Squeegee Crew`, short_name `Squeegee Crew`, start_url `/team`, scope `/team`, display standalone, colors `#0A0A0A`, same icons as crm-manifest. `app/team/layout.tsx` → `manifest: "/team-manifest.json"`.
- `/team/me` PushCard keeps working; its iOS card can stay.

### 4.3 Never
- Never read or render `price`. Never widen a `/team` select. Never call Supabase from the browser.

## 5. Acceptance (orchestrator runs these; builders make them true)
1. `npm run verify` green; `npm run build` green.
2. Behavioral (prod build, throwaway employee + job, deleted after): on_my_way → alert row pending + `sms_messages` row kind `crew_alert_owner` and **no** customer sms; inbound YES from Anthony's number → alert confirmed + customer sms row kind `on_my_way`; second YES → falls through (no pending); arrived → same shape; in_progress with a service lacking a before photo → 400 with `missing`; photo POST without/invalid `service` → 400; complete without after photos for every service → 400; employee with `can_contact_customers=false` → job page HTML has no `tel:`; `crew_pay` PATCH persists and `/team/me` shows it after completion; the Worth-it panel numbers match a hand SQL sum.
3. Browser at 390px: modal on Start job; CameraSheet fallback path renders; START JOB lit state; install sheet on a non-standalone load; `/team-manifest.json` served with start_url `/team`.
