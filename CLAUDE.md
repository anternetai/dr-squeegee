# Dr. Squeegee

Anthony's exterior cleaning business in Charlotte, NC — window cleaning, house
soft-washing, driveway/paver/pool-deck cleaning, gutters, roof soft wash.
Premium, low-volume, high-trust positioning. He runs it himself.

- **Live:** drsqueegeeclt.com — marketing site, client portal, and the CRM at `/crm`
- **Repo:** `anternetai/dr-squeegee` (Next.js, Vercel). Split out of
  `anternetai/anternet` in March 2026 — that repo still holds HomeField Hub, a
  separate business. **Never conflate the two.**
- **Stack:** Next.js · Supabase (project `umugyukdedithkbtnhtd`) · Stripe · Cal.com ·
  Twilio · Resend · Slack · n8n on Railway

## Telephony — Twilio

Dr. Squeegee is **Twilio**. (Telnyx belongs to HomeField Hub. Do not mix them up —
this has caused confusion before.)

- Business line **(980) 252-8701**, forwards to Anthony's cell
- A2P 10DLC campaign **C8TKR2H — verified**, sends via `TWILIO_MESSAGING_SERVICE_SID`
- Inbound voice webhook: `app/api/twilio/voice/route.ts`

## SMS rules — these are legally load-bearing

`lib/squeegee/sms.ts` is the single send path and enforces all of it. Do not bypass it.

1. A number in `sms_opt_outs` is never texted.
2. Consent is required by default (`squeegee_leads.sms_consent` / `squeegee_clients.sms_consent`).
3. Every send is logged to `sms_messages` — that is the A2P audit record.
4. Opt-out language rides on every outbound body.
5. **While `SMS_LIVE !== "true"`, every message redirects to `SMS_TEST_TO`** and is
   stamped `was_test`. Going live is Anthony's decision, never a side effect of a change.

## Scheduling — Cal.com

`lib/squeegee/calcom.ts`. Account `drsqclt`, hidden event type `service-job`, 60 min fixed.

- API v2 only (v1 shut down April 2026), and `cal-api-version` **differs per resource**:
  event-types `2024-06-14`, slots `2024-09-04`, bookings `2024-08-13`. These were
  verified against the live account — a wrong value silently downgrades the response
  shape instead of erroring.
- Cal rejects a top-level `title` on POST /bookings; the desired title is embedded in
  `attendee.name`. `lengthInMinutes` cannot be overridden per booking. Both are
  documented in that file's header — read it before "fixing" either.
- Cal.com already syncs to Anthony's Google Calendar. The repo *also* has its own
  googleapis sync (`lib/google-calendar.ts`, the "Sync to Google Calendar" button).
  **Using both on one job creates two calendar events.**

## Pricing

`lib/squeegee/pricing.ts` is the source of truth. Windows are per-window with story
and coverage multipliers and a $200 job minimum applied once to the combined total;
flat surfaces are per-sqft; house washing is flat tiers. **Gutters and roof soft wash
have no pricing model** — on-site quote only. Never generate a number for them.

Anything that mirrors these constants elsewhere (e.g. the voice agent's n8n Code
node) must say so in a comment and be re-synced when they change.

## Key tables

`squeegee_leads` · `squeegee_clients` · `squeegee_jobs` · `squeegee_quotes` ·
`squeegee_invoices` · `squeegee_activity` · `sms_messages` · `sms_opt_outs`

Job lifecycle: `new → quoted → approved → scheduled → complete`.
Public quote URLs: `drsqueegeeclt.com/q/{token}`.

## Machine-to-machine auth

New endpoints called by n8n or another service go **outside** `/api/portal/**` and
`/api/crm/**` (so no cookie logic is in play) and check a bearer shared secret —
follow the `CRON_SECRET` pattern rather than inventing something new.

## After-hours voice agent

**Live since 2026-09-08.** Start at `voice-agent/HANDOFF.md` (ids, what was verified, what
still needs a real test call); `voice-agent/RUNBOOK.md` is the operator view.

A Vapi assistant answers calls Anthony misses (Twilio hands the live call to the Vapi
number +1 864 727 5081), backed by n8n webhooks that quote from the pricing above,
book through Cal.com, upsert the client, and alert him by Slack DM + SMS. Kill switch:
`VAPI_PHONE_NUMBER=""` in Vercel. The skill at
`.claude/skills/voice-agent-vapi-n8n/` carries the reusable knowledge.

## House rules

- No MVPs. Ship complete, quality work; don't hold features back for "later".
- Use Sonnet subagents freely for building and research; Opus orchestrates and reviews.
- **An Opus review agent reviews and pushes. The main agent never pushes directly.**
- Never auto-launch agents on session resume — ask Anthony first.
