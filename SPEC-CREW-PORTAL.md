# SPEC — Dr. Squeegee Crew Portal v2

**Written:** 2026-09-02 · **Status:** BUILT 2026-09-05, not yet pushed · **Repo:** `anternetai/dr-squeegee`

> **Build status (2026-09-05).** Steps 1-9 all implemented. Verified locally: tsc + lint + build
> green; concurrent-claim race, server-side photo gate, PIN lockout, and the price-leak grep all
> pass against a running server (see the session close-out). **Not deployed** — this repo's
> CLAUDE.md says the main agent never pushes; an Opus review agent does.
>
> Outstanding before it works in the field:
> 1. `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` must be set in Vercel
>    (they exist in `.env.local` only). Without them push is inert and degrades honestly.
> 2. Push untested on physical iOS/Android handsets.
> 3. The crew has no PIN yet — each member sets one at `/team/join/[token]`.
> 4. The on-my-way SMS has only been exercised with `SMS_LIVE=false`.
**Outcome in one sentence:** Anthony stops telling his employee where and when the jobs are.

Interview: 12 questions answered by Anthony 9/2. Research: `AI_Training/research/crew-portal-field-crm-research.md`
(Jobber, Housecall Pro, ServiceTitan, Workiz, Service Fusion, ServiceM8, Kickserv, FieldPulse — evidence-tagged).

---

## 1. Verified current state (queried prod 9/2, not assumed)

| Fact | Value |
|---|---|
| Jobs in `squeegee_jobs` | 69 |
| Jobs with `assigned_employee_id` set | **0** |
| Rows in `squeegee_employees` | 1, named "Test", `last_login_at` = **null** |
| Job statuses in use | `new`(1) `quoted`(13) `approved`(9) `scheduled`(11) `complete`(35) |
| Notification on assignment | **none** — `POST /api/squeegee/jobs/[id]/assign` writes one column, returns |
| File upload anywhere in repo | none (`storage.from`, `type="file"`, `capture=` → zero matches) |
| Storage buckets in project | `session-recordings`, `brand-assets`, `ore-captures` (Storage is proven here) |

**Root cause of the pain:** the portal isn't broken — it's empty and silent. Assignment is a manual step that never
happens, and even when it does, nothing reaches the employee's phone.

### What already exists and gets KEPT
- `/team` (login → today/upcoming/done cards, maps link, call/text, Mark done + note, onboarding checklist)
- `/team/standards` (mission, values, expectations)
- `/team/join/[token]` crew onboarding + agreement signature
- `crew_session` HMAC httpOnly cookie, 30-day, scrypt passwords — `lib/squeegee/employee-auth.ts`
- `/crm/team`, `/crm/team/[id]`, `/crm/ops` assign UI, `POST /api/squeegee/jobs/[id]/assign`
- `lib/squeegee/employees.ts` — ROLES / STATUSES / PAY_TYPES / DAYS constants

---

## 2. Decisions (Anthony's answers — these are settled, do not re-litigate)

| # | Decision | Answer |
|---|---|---|
| 1 | Notification transport | **PWA push only.** No SMS to crew. Free, zero carrier cost. |
| 2 | Crew scope | **Full lifecycle + photos + time clock.** |
| 3 | Money visible to crew | **His own pay only.** Never the customer price. |
| 4 | Crew login | **Phone + 4-digit PIN.** |
| 5 | How a job reaches him | **Shared claim pool** — he claims from an open board. |
| 6 | Unclaimed jobs | **Fall to Anthony, loudly** — red alert in CRM 24h out. |
| 7 | Time clock shape | **Per job, auto from status.** No separate clock button. |
| 8 | Photos | **Before + after required, hard-gates completion.** |
| 9 | Photos → customer | **Yes, but Anthony approves each one first.** |
| 10 | "On my way" → customer text | **Yes, auto-send.** (Outward-facing — explicitly authorized 9/2.) |
| 11 | Crew size | **One now, hiring more soon** → build multi-crew, no one-person shortcuts. |
| 12 | Photo backend | **Native Supabase Storage, not CompanyCam.** |

### The one open conflict — flagged, not blocked
Anthony chose **PWA push only**. Research finding [DOC]: Housecall Pro maintains a help article whose documented fix
for a tech not receiving job notifications is *"delete and reinstall the app."* Push is the least reliable link in
this category, and on **iOS it silently delivers nothing until the site is added to the home screen** — undetectable
from the server.

**Resolution taken (revised at build time):** push only, as chosen. The `crew_sms_enabled` fallback flag proposed
here was **not built** — it would have been dead code hedging a decision Anthony made twice, and dead code that has
never run is not a safety net. The visibility it was meant to buy is delivered instead by the push-health panel on
`/crm/team/[id]`: device count, last successful delivery, and failure count, so a silent push failure is something
Anthony can SEE rather than something he discovers when a job gets missed. The open board also remains the source of
truth, so a missed notification never means a missed job. If push does prove unreliable in the field, adding the SMS
digest is a small change to `app/api/cron/crew-digest/route.ts`, which already assembles exactly the right message.

---

## 3. Data model

All changes additive. **Do not alter `squeegee_jobs.status`** — 12+ surfaces (receipts, invoices, review flow,
`/crm/ops`, dashboard tiles) branch on its current vocabulary. The crew lifecycle gets its own column.

### 3.1 `squeegee_jobs` — new columns
```sql
alter table squeegee_jobs
  add column field_status text,   -- null | 'on_my_way' | 'in_progress'  (complete still writes status='complete')
  add column claimed_at   timestamptz,
  add column crew_pay     numeric;  -- per_job employees only; hourly derives from the clock
```
`field_status` is null for every historical row and every job the crew hasn't touched. Existing reads are unaffected.

### 3.2 `squeegee_job_time` — new table
```sql
create table squeegee_job_time (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references squeegee_jobs(id) on delete cascade,
  employee_id uuid not null references squeegee_employees(id),
  kind text not null,               -- 'drive' | 'work'
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index on squeegee_job_time (employee_id, started_at desc);
create index on squeegee_job_time (job_id);
```
Driven entirely by status taps — **no separate clock button** (research §10.1 #5: a day-timer alongside job-timers is
the documented source of accidental-timer complaints):
- tap **On my way** → open a `drive` segment
- tap **Start** → close `drive`, open `work`
- tap **Done** → close `work`

Add an **admin force-clock-out** in `/crm/team/[id]` (the gap reviewers ask Jobber for [REV]) — closes any segment
left open past midnight.

### 3.3 `squeegee_job_photos` — new table
```sql
create table squeegee_job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references squeegee_jobs(id) on delete cascade,
  employee_id uuid references squeegee_employees(id),
  kind text not null,                                -- 'before' | 'after'
  storage_path text not null,
  customer_visible boolean not null default false,   -- Anthony flips this; never the crew
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on squeegee_job_photos (job_id, kind);
```

### 3.4 `squeegee_push_subscriptions` — new table
```sql
create table squeegee_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references squeegee_employees(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count int not null default 0
);
```
`failure_count` matters: a dead subscription must be visible in `/crm/team` so a silent push failure is *observable*.

### 3.5 `squeegee_employees` — new columns
```sql
alter table squeegee_employees
  add column pin_hash text,        -- scrypt, same helper as password_hash
  add column pin_attempts int not null default 0,
  add column pin_locked_until timestamptz;
```

### 3.6 RLS
Every new table: **RLS on, zero policies** (service-role only), matching the 7/25 lockdown
(`reference_supabase_anon_key_rls.md`). The `job-photos` bucket is **private**; customer-visible photos render
through signed URLs minted server-side on the receipt page.

---

## 4. Auth change — phone + 4-digit PIN

Replaces email + password at `/team/login`. Keep the existing password path working during transition; drop it once
the crew is migrated.

**A 4-digit PIN is 10,000 combinations. It is only safe with lockout, and this is auth — danger list.** Required:
- Rate limit **5 attempts per phone per 15 minutes**, then `pin_locked_until` = now + 15 min. Escalate to 1 hour after
  three lockouts.
- Response time and error copy identical for "wrong PIN" and "unknown phone" — no enumeration.
- Log every failed attempt with IP to `squeegee_activity`.
- PIN set by the **employee** during `/team/join/[token]` onboarding, never assigned by Anthony, never shown in the CRM.
- Session stays the existing HMAC `crew_session` cookie, 30 days. He logs in roughly never.

Rejected: 6-digit SMS code (research's pick, [DOC] — more secure, but costs a text per login and Anthony chose PIN).

---

## 5. Screens — three, phone-only

Research §10.2 #20: Housecall Pro deliberately gives field techs **no web surface at all**. Don't build two.
All three live under `/team`, `max-w-lg`, dark, existing teal `#2D8C6F`.

### 5.1 `/team` — Today
- **My stops today** — claimed jobs, ordered by time. Card: service icon, customer name, address (tap → maps),
  arrival window, status chip. Card actions without opening the job: call, directions, next status button.
- **Open board** — unclaimed `scheduled` jobs. Card + a big **"I've got this one"** button.
  Claim is a conditional write:
  `update … set assigned_employee_id = :me where id = :job and assigned_employee_id is null`
  — returns 0 rows if someone beat him to it, and the UI says so. Race-safe by construction.
- **This week** — collapsed count only. No pricing anywhere on this screen.

### 5.2 `/team/jobs/[id]` — Job
- Top of fold: **one** status button — only the next legal one (`On my way` → `Start` → `Done`).
  `On my way` opens Jobber's six-preset ETA picker: **5 / 10 / 15 / 30 / 45 / 60 min** [DOC].
- Call · Text · Directions row.
- Access notes / scope of work (from `notes`).
- **Photos** — Before rail and After rail. Camera opens directly:
  `<input type="file" accept="image/*" capture="environment" multiple>`.
- Live timer showing elapsed work time.
- **Done is disabled until ≥1 before and ≥1 after photo exist**, with the reason stated on the button, not hidden
  in a toast. Hard block, Housecall-Pro style [DOC] — not Jobber's soft nag.

### 5.3 `/team/me` — Me
- This week's hours (sum of `work` + `drive` segments).
- **His pay only:** hourly → hours × `pay_rate`. per_job → sum of `crew_pay` on completed jobs.
  **Never** `squeegee_jobs.price`. Mirrors Jobber's "Field crew" preset verbatim: cannot see pricing, costs,
  margins, or anyone else's schedule [DOC].
- Push status + the add-to-home-screen walkthrough (see §7).
- Link to `/team/standards`, log out.

---

## 6. Photo pipeline

1. **Capture** — `capture="environment"`, multiple. No app, no install.
2. **Compress client-side before upload** — canvas → 1600px long edge, JPEG q0.8. ~3.5MB → ~250KB.
   **This step is load-bearing:** at raw size the Supabase free 1GB tier is gone in ~3 months; compressed,
   ~30MB/month ≈ 3 years.
3. **Upload** → `POST /api/team/jobs/[id]/photos`, `crew_session`-gated, verifies the job is claimed by the caller,
   service-role writes to `job-photos/{job_id}/{kind}/{uuid}.jpg`.
4. **Offline queue** — IndexedDB, retry on reconnect. He will shoot photos in driveways on one bar. Without this
   the first "I took them and it didn't save" kills trust in the whole portal.
5. **Approval** — photos land `customer_visible = false`. Anthony approves in the CRM job view. Only approved
   photos render on the customer's `/r/[token]` receipt via signed URL.

**Category gap being exploited** (research §5.3): every product studied buries before/after shots in an internal
attachment silo — Housecall Pro splits them into two silos that don't talk, Jobber won't attach a photo to an
invoice from the phone at all. For pressure washing **the photos are the deliverable.** Dr. Squeegee already has
the branded `/r/[token]` surface; approved after-photos on the receipt is a small extension with an obvious
review-request tie-in (`/review` already ships).

---

## 7. Push notifications

Standard Web Push: VAPID keys in env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`), `web-push` on the
server, a service worker at `/team/sw.js`, subscription stored per §3.4.

**Triggers**
- New job posted to the open board.
- A job he claimed changes date/time — **debounced 60s after the last edit** (Jobber's non-obvious detail [DOC]).
- 6:00 AM ET on days he has claimed work: "3 stops today — first is 7:30 at 4412 Sardis Rd."

**iOS is the risk.** Safari delivers zero push until the site is added to the home screen, and the server cannot
detect this. Mitigations, all required:
- A can't-miss setup card on `/team/me` that walks through Share → Add to Home Screen, with live detection of
  `display-mode: standalone`.
- `/crm/team` shows per-employee: **push subscribed yes/no**, last successful delivery, failure count. If it's
  broken, Anthony sees it in the CRM rather than finding out when a job gets missed.
- Because push may fail silently, **the open board is the source of truth** — the portal always shows the real
  schedule whether or not a notification ever arrived.

---

## 8. Customer-facing SMS — authorized 9/2

On **On my way**, one text through the existing consent-gated `lib/squeegee/sms.ts` (the single send path — opt-out
honored, consent-gated, logged). Copy for approval before wiring:

> `Dr. Squeegee is on the way — about 20 minutes out. Reply STOP to opt out.`

Rules: link (if any) sends as **its own bare message**, never inside prose — `reference_sms_link_delivery.md`, the
em-dash/UCS-2 finding from 8/25. GSM-7 only, keep it one segment. De-dupe: one OMW text per job, ever.

On **Done**, no new text — `smsReviewOnce` already fires the review ask from the completion route. Do not add a
second message.

---

## 9. CRM side (`/crm`)

- **Red "NOBODY CLAIMED THIS"** panel on the dashboard for `scheduled` jobs, unclaimed, <24h out. This is the
  safety net for the pool model — a job can never quietly go unworked.
- Job detail: live field status, timeline (claimed → OMW → started → done with timestamps), photo grid with
  per-photo **Approve for customer** toggle.
- `/crm/team/[id]`: hours this week/pay period, force-clock-out, push subscription health, `crew_sms_enabled` flag.
- Keep manual assign — the pool is the default path, direct assign is the override.

---

## 10. Acceptance checks — define done BEFORE building (SOP §2)

Each must be *observed*, not asserted:

1. Two browser sessions hit **Claim** on the same job simultaneously → exactly one wins, the loser sees
   "someone already claimed this." (Race proof — conditional update returns 0 rows.)
2. A real job walked end to end on a **physical phone**: claim → OMW → start → 2 photos → done. Assert:
   `squeegee_job_time` has one closed `drive` and one closed `work` segment; `squeegee_job_photos` has ≥1 before
   and ≥1 after; `squeegee_jobs.status = 'complete'`.
3. **Done** tapped with zero after-photos → button disabled, API returns 400. The gate is enforced server-side,
   not only in the UI.
4. PIN brute force: 6 wrong PINs → locked out, `pin_locked_until` set, and the 6th response is indistinguishable
   from an unknown-phone response.
5. Crew portal HTML contains **no customer price**: `curl /team | grep -c "price"` → 0. Also grep the JSON payloads
   of every `/api/team/*` response.
6. OMW text arrives on a **real handset in test mode**, one segment, GSM-7, link (if present) as its own message.
   Never to a real customer during testing — danger list.
7. Push received on a physical Android handset **and** on an iOS handset after add-to-home-screen.
8. `npm run verify` green (tsc + lint + build).
9. Prod probe after deploy — `/team` and `/team/me` return 200 on the real domain, and the Vercel deploy reads
   READY via MCP (deploys have silently failed here before).
10. Anon-key probe against all four new tables returns **zero rows**.

---

## 11. Explicitly OUT of scope (research §10.2 — don't build these)

Geofenced auto-arrival · live GPS crew map · in-app chat · route optimization · signature capture · tech-created
estimates · pricebook · job costing/margin views · field card payments · custom status builder · equipment tracking ·
expense capture · multiple schedule views · per-file visibility toggles on every asset (policy is hard-coded:
before/after = customer-visible after approval, everything else internal) · **any web surface for crew** · a native
app-store build.

---

## 12. Risks

| Risk | Falsifier / mitigation |
|---|---|
| iOS push silently dead | `/crm/team` surfaces subscription health; open board works regardless |
| 4-digit PIN brute-forced | Lockout + rate limit + no enumeration; if it worries him, switch to 6-digit |
| Photo gate causes him to abandon a job half-done | Job stays `in_progress`, visible to Anthony — no silent loss |
| Free-tier storage fills | Compression is mandatory, not optional; monitor bucket size monthly |
| Claim pool leaves jobs unowned | §9 red panel + 24h alert |
| Crew SMS flag accidentally enabled | Defaults OFF, requires an explicit CRM toggle |

---

## 13. Build order (each step independently verifiable)

1. Migrations + RLS (§3) — prove with an anon-key probe returning zero rows.
2. PIN auth + lockout (§4) — prove with the brute-force check.
3. Claim pool + open board (§5.1) — prove with the concurrent-claim race.
4. Status lifecycle + time clock (§5.2, §3.2) — prove with the end-to-end phone walk.
5. Photos + compression + gate (§6) — prove the server-side 400.
6. CRM: unclaimed alert, timeline, photo approval (§9).
7. Push + iOS setup flow (§7).
8. OMW customer SMS (§8) — **last**, after Anthony signs off on the copy.
9. Receipt integration for approved photos.

Steps 1–6 are the portal working. 7–9 are the polish that makes it feel like a product.
