# Dr. Squeegee Voice Agent — n8n Tool Backend

Five webhook workflows that back the Vapi voice assistant's tools. Vapi POSTs
a tool call to each; every workflow always returns HTTP 200 with
`{"results":[{"toolCallId":"...","result":"..."}]}`, including on business
failure (the failure sentence goes in `result` so the assistant can speak it).

n8n instance: **https://n8n-production-1286.up.railway.app** (Railway
project "peaceful-trust", service `n8n`).

---

## 1. Credentials (all created, ids referenced inside the JSONs)

| Credential | Type | id | Used by |
|---|---|---|---|
| Vapi Tool Secret | Header Auth (`x-vapi-secret`) | `wycoqjtM2qevxil3` | every Webhook node |
| Cal.com API Key (drsqclt) | Header Auth (`Authorization: Bearer cal_live_…`) | `6N8Gw12AStkWa9P3` | Cal.com HTTP nodes |
| Twilio API Key (Dr Squeegee AC1ee98) | Basic Auth (API key SID / secret) | `Sm4NXmuBaNMtJ9WN` | Text Anthony nodes |
| Supabase Database | Postgres | `WJrBNk44uOAqNA1S` | all Postgres nodes |
| Slack Bearer Token | Bearer Auth | `28t8r7NccDmq8NVt` | Slack HTTP nodes |

**No Railway env vars are read.** This n8n instance blocks `$env` inside nodes
("access to env vars denied", observed 2026-09-08), so the Twilio account SID and
messaging-service SID are `REPLACE_ME_*` placeholders that `deploy.py` injects from
`TWILIO_ACCOUNT_SID` / `TWILIO_MESSAGING_SERVICE_SID` (a public repo must not carry an
Account SID — GitHub push protection blocks it), and the owner number is a constant. Slack goes through
HTTP Request + `chat.postMessage` + Bearer Auth (house rule: never the native Slack node).

## 2. Deploying

```bash
python validate.py && node test-nodes.js        # structure + 52 behavioural checks
N8N_API_KEY=… TWILIO_ACCOUNT_SID=… TWILIO_MESSAGING_SERVICE_SID=… python deploy.py   # upsert + activate; --dry-run, --only <file>
```

Production path is `/webhook/…`, never `/webhook-test/…`, and only after activation.

### Postgres writes take ONE base64(JSON) parameter — keep it that way

The Postgres node splits its resolved *Query Parameters* string on commas (observed:
"123 Maple St, Charlotte, NC 28205" became three parameters). Every write node
therefore receives a single `{{ $json.xPayloadB64 }}` and unpacks it in SQL with
`convert_from(decode($1,'base64'),'UTF8')::jsonb`. Never put caller text in a bare
`{{ }}` parameter.

## 3. Per-workflow reference

### `vapi-lookup-caller.json`
- **Path:** `vapi/lookup-caller`
- **Production URL:** `https://n8n-production-1286.up.railway.app/webhook/vapi/lookup-caller`
- **Credentials:** Vapi Tool Secret; Supabase Database (Postgres)
- **Env vars:** none beyond the shared setup above
- **What it does:** one Postgres round trip (CTEs) matching the caller's
  number (last-4 pre-filter, then exact normalized compare) against
  `squeegee_clients`, the most recent `squeegee_jobs` row, and any pending
  `squeegee_quotes` row. Returns a short spoken summary; explicitly flags a
  `blacklisted` client so the assistant can wrap the call up politely.

### `vapi-quote-service.json`
- **Path:** `vapi/quote-service`
- **Production URL:** `https://n8n-production-1286.up.railway.app/webhook/vapi/quote-service`
- **Credentials:** Vapi Tool Secret only — **no Postgres or HTTP calls at
  all**, pure computation in the Compute Quote Code node.
- **Env vars:** none.
- **What it does:** prices windows (per-story, combined $200 minimum applied
  once), sqft services, and house-wash tiers from constants hand-mirrored
  from `lib/squeegee/pricing.ts`. Gutters/roof soft-wash (no pricing rule in
  code) always return "needs an on-site look," never a guessed number.
  Supports multiple services in one call via `services[]`.

### `vapi-check-availability.json`
- **Path:** `vapi/check-availability`
- **Production URL:** `https://n8n-production-1286.up.railway.app/webhook/vapi/check-availability`
- **Credentials:** Vapi Tool Secret; Cal.com API Key (Header Auth)
- **Env vars:** none
- **What it does:** looks up the `service-job` event type, then open slots
  over the requested window (default 7 days), speaks back up to 3 slots, each
  tagged `[appointmentDate YYYY-MM-DD, appointmentTime HH:MM]` for book_job,
  converted to America/New_York using a DST-correct offset (via
  `Intl.DateTimeFormat`, not a hardcoded -04:00/-05:00).

### `vapi-book-job.json`
- **Path:** `vapi/book-job`
- **Production URL:** `https://n8n-production-1286.up.railway.app/webhook/vapi/book-job`
- **Credentials:** Vapi Tool Secret; Cal.com API Key; Twilio API Key; Slack Bearer Token;
  Supabase Database
- **Env vars:** none at runtime (Twilio SIDs are injected by deploy.py)
- **What it does:** looks up the event type → books Cal.com → upserts the
  `squeegee_clients` row by phone (recording verbal SMS consent when given) and inserts
  `squeegee_jobs` linked by `client_id` (leaving `google_calendar_event_id` NULL — Cal.com's own
  Google Calendar sync already puts it on Anthony's calendar; also writing
  via the app's separate googleapis sync would double-book) → responds to
  Vapi immediately, then fans out `squeegee_activity` insert + Slack DM + SMS
  in parallel off that same success branch. If the Cal.com booking call
  fails (slot just taken), the caller is told to pick another time and **no
  job row is written**.

### `vapi-capture-lead.json`
- **Path:** `vapi/capture-lead`
- **Production URL:** `https://n8n-production-1286.up.railway.app/webhook/vapi/capture-lead`
- **Credentials:** Vapi Tool Secret; Twilio API Key; Slack Bearer Token;
  Supabase Database
- **Env vars:** none at runtime (Twilio SIDs are injected by deploy.py)
- **What it does:** inserts `squeegee_leads` (`source='voice_agent'`,
  `status='new'`), responds fast, then fans out Slack DM + SMS to Anthony.

---

## 4. Webhook path list

| File | Path | Production URL |
|---|---|---|
| `vapi-lookup-caller.json` | `vapi/lookup-caller` | `https://n8n-production-1286.up.railway.app/webhook/vapi/lookup-caller` |
| `vapi-quote-service.json` | `vapi/quote-service` | `https://n8n-production-1286.up.railway.app/webhook/vapi/quote-service` |
| `vapi-check-availability.json` | `vapi/check-availability` | `https://n8n-production-1286.up.railway.app/webhook/vapi/check-availability` |
| `vapi-book-job.json` | `vapi/book-job` | `https://n8n-production-1286.up.railway.app/webhook/vapi/book-job` |
| `vapi-capture-lead.json` | `vapi/capture-lead` | `https://n8n-production-1286.up.railway.app/webhook/vapi/capture-lead` |

---

## 5. Validating the JSON files

`validate.py` (in this folder) loads every `vapi-*.json` file and checks
structure; `test-nodes.js` executes every Code node against realistic payloads
(pricing floors, DST, noon speech, JSON-string arguments, failure paths). Run both.
`validate.py` checks structure, node shape, connection integrity, reachability from the webhook
trigger, and typeVersions against the table in CONTEXT.md. Run:

```
python3 validate.py
```

It exits 0 when every file passes.

---

## 6. Decisions made during this build (worth a quick review)

- **Resilience beyond the literal spec:** the brief required `onError:
  "continueErrorOutput"` + dual-wiring specifically for HTTP Request nodes.
  To actually guarantee "HTTP 200 always," the same treatment was extended
  to the **critical-path Postgres nodes** too (lookup-caller's query,
  book-job's and capture-lead's inserts) — each has an error output wired
  to a response-builder so a DB hiccup still produces a graceful spoken
  result instead of an unhandled n8n error with no response at all.
- **Fire-and-forget nodes use `continueRegularOutput`, not
  `continueErrorOutput`.** The blanket "both outputs wired into the
  response-builder" rule is applied only to HTTP nodes on the critical path
  to the response (Cal.com lookups/booking, the availability calls). Slack
  and Twilio notification nodes run *after* the response is already built,
  so there is no response-builder left to wire a second output into —
  they're set to not stop the workflow on failure instead.
- **book-job resilience if the local DB insert fails after a real Cal.com
  booking:** rather than leaving Anthony blind to a booking that exists on
  the calendar but not in the CRM, the Postgres error branch still tells the
  caller they're booked *and* still fans out to Slack/SMS (those nodes build
  their message from the parsed tool-call args, not from the DB row, so they
  don't depend on the insert having succeeded). Same pattern applied in
  capture-lead.
- **windowCounts keys:** the tool schema sends `story1/story2/story3`; legacy `"1"/"2"/"3"`
  keys are still accepted. (The 8/28 build only read the legacy keys — real calls
  never priced windows.)
- **Window quote minimum:** the $200 minimum + round-to-5 is applied once to
  the *combined* raw window total across every window-type entry in
  `services[]` (summed pre-minimum), matching "not per story, not to the
  grand total of unrelated services." If a `windowCounts` entry is present
  but sums to zero, it's treated as "no windows counted" and skipped rather
  than forcing the $200 minimum.
- **Availability slot speech** dedupes the weekday+day phrase when two of
  the top-3 slots land on the same day (e.g. "Tuesday the second at nine in
  the morning, Tuesday at two in the afternoon…") but always keeps the
  morning/afternoon/evening qualifier on every slot for clarity, rather than
  dropping it as in the prompt's flavor example — a phone caller can't see a
  transcript, so explicit is safer than terse.
- **Cal.com slots endpoint auth:** the brief's step (b) only called out the
  `cal-api-version` header explicitly; the `Authorization` bearer
  header was added there too (since replaced by the Cal.com Header Auth credential, matching step a and
  the booking call), since Cal.com v2 endpoints require it.
- **Sticky notes** were added on-canvas (not just in this README) reminding
  Anthony to swap the placeholder credentials, since that's the moment he's
  most likely to see it.
- **Twilio credential composition:** "Twilio API Key" is documented as
  `TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET` (API Key auth) rather than
  the account Auth Token, since both already exist as env vars in the main
  app and API Key auth is the safer of the two to hand to a third-party
  automation tool. Confirm this matches Anthony's intent before activating.
