# Dr. Squeegee Voice Agent — Build Context (verified 2026-08-28)

## The business
Dr. Squeegee — exterior cleaning, Charlotte NC. Owner: Anthony. Premium/low-volume positioning.
Domain drsqueegeeclt.com. CRM at drsqueegeeclt.com/crm. Repo `anternetai/dr-squeegee` (Next.js 16, Vercel).
Slack DM user ID for Anthony: `U0ABZDLENJ1`.

## Telephony — TWILIO (NOT Telnyx; Telnyx belongs to the other business, HomeField Hub)
- Business line: **+1 980 252 8701**
- Forwards to Anthony's cell: **+1 980 242 8048**
- A2P 10DLC campaign **C8TKR2H — VERIFIED**. Messaging service env `TWILIO_MESSAGING_SERVICE_SID`.
- Existing inbound voice webhook: `app/api/twilio/voice/route.ts`
  - Auth = `?token=` query param matching env `TWILIO_VOICE_TOKEN` (no signature validation available)
  - First hit returns: `<Dial callerId="+19802528701" timeout="25" action="/api/twilio/voice?token=..." method="POST">+19802428048</Dial>`
  - Second hit carries `DialCallStatus`; `completed|answered` -> `<Hangup/>`; anything else -> a `<Say>` "text us instead" message.
  - **THE MISSED-CALL GAP IS THIS ELSE BRANCH.** That is where Vapi must take over.

## Cal.com — ALREADY INTEGRATED (lib/squeegee/calcom.ts)
- Account username `drsqclt`. API base `https://api.cal.com/v2`. Env `CAL_COM_API_KEY`.
- **Per-resource API versions verified live against this account on 2026-07-17:**
  - event-types: `cal-api-version: 2024-06-14`
  - bookings:    `cal-api-version: 2024-08-13`
  (Newer generic docs say bookings 2026-02-25 — DO NOT change what already works without re-verifying.)
- Event type: slug `service-job`, title "Service Job", hidden, fixed 60 min. ID looked up/created at runtime.
- Cal v2 rejects a top-level `title` on POST /bookings. Title is auto-generated. Workaround already in
  use: put "<client> — <service>" into `attendee.name`. `bookingFieldsResponses.notes` -> booking description.
- `lengthInMinutes` cannot be overridden per booking on a single-length event type.
- Attendee email is always `care@drsqueegeeclt.com` (clients are phone-first; Cal emails go to the owner).
- Cal.com has Google Calendar connected (anternetai@gmail.com) so bookings hit Anthony's real calendar.
- **DOUBLE-BOOKING RISK (pre-existing):** the repo ALSO has its own googleapis sync
  (`lib/google-calendar.ts` + "Sync to Google Calendar" button). Using both on one job = two events.
  The voice agent must use Cal.com ONLY.
- Helpers that already exist and should be mirrored: `easternOffsetFor(dateStr)` and
  `buildEasternISOString(date,time)` produce DST-correct ISO with explicit ET offset.

## Pricing — REAL constants from lib/squeegee/pricing.ts (source of truth; the Obsidian pricing.md is ASPIRATIONAL and differs — use the code)
WINDOW_PRICING = { base: 7 /* $/window, exterior, 1st story */,
                   storyMult: {1:1, 2:1.3, 3:1.7},
                   coverageMult: {exterior:1, both:1.8},
                   minJob: 200, roundTo: 5 }
  computeWindowPriceMulti(counts, coverage): sum per-story (count*7*storyMult), * coverageMult,
    round to nearest 5, then Math.max(minJob, rounded).  Minimum + rounding applied ONCE to the combined total.
SQFT_SERVICE_DEFAULTS = { Driveway: 0.20, "Surface Cleaning": 0.18, "Pool Deck": 0.22, Pavers: 0.25 }
  computeSqftPrice(sqft, rate) = Math.round(sqft * rate)
HOUSE_WASH_TIERS (flat):
  1-story-standard  "1-story, up to 1,500 sqft"    300
  1-story-large     "1-story, large (1,500+ sqft)" 350
  2-story-standard  "2-story, up to 2,500 sqft"    400
  2-story-large     "2-story, large (2,500+ sqft)" 475
  3-story           "3-story"                      550
NOTE: no gutter or roof-softwash constants exist in code. Those are quote-on-site only.

## Supabase (project ref `umugyukdedithkbtnhtd`, name "roofing-leads" — shared instance)
squeegee_leads(id uuid pk, created_at, name NOT NULL, phone NOT NULL, email, address,
  services text[] NOT NULL, property_type, timeline, source default 'landing_page',
  status default 'new', utm_source, utm_medium, utm_campaign, converted_job_id uuid,
  sms_consent bool default false, sms_consent_timestamp)
squeegee_clients(id, created_at, name NOT NULL, phone, email, address, notes,
  blacklisted bool default false, blacklist_reason,
  sms_consent bool default false, sms_consent_at, sms_consent_method, sms_consent_note)
squeegee_jobs(id, created_at, client_name NOT NULL, client_phone, client_email, address NOT NULL,
  service_type NOT NULL, notes, price numeric, status default 'new'
  CHECK in (new,quoted,approved,scheduled,complete), appointment_date date, appointment_time time,
  client_id uuid, google_calendar_event_id, cal_booking_uid, assigned_employee_id,
  completed_at, completion_note, reminder_sent_at)
squeegee_quotes(id, token default 10-char, job_id, client_name NOT NULL, client_phone, client_email,
  address NOT NULL, services jsonb NOT NULL default '[]', total_price numeric NOT NULL default 0,
  status default 'pending', client_response_at, created_at, discount_type, discount_value,
  subtotal, followup_count int default 0, last_followup_at)
  -> public quote URL is drsqueegeeclt.com/q/{token}
squeegee_activity(id, created_at, job_id, type NOT NULL, note NOT NULL)
sms_messages(id, created_at, direction, phone10, to_phone, body, kind, status default 'queued',
  twilio_sid, related_type, related_id, was_test bool default false, error)
sms_opt_outs(phone10 pk, opted_out_at, source)

## SMS rules baked into lib/squeegee/sms.ts — MUST be honored by anything that texts
1. Never text a number present in sms_opt_outs.
2. Default requires recorded consent (squeegee_leads.sms_consent or squeegee_clients.sms_consent).
3. Every send logged to sms_messages.
4. Opt-out tail "Reply STOP to opt out." appended to every outbound body.
5. **If env SMS_LIVE !== "true", every message is redirected to SMS_TEST_TO (Anthony's cell) and
   stamped was_test.** The live flip is a human decision.
Phone normalization: strip non-digits, drop leading 1 from 11-digit, require 10 -> phone10 + e164 "+1"+ten.

## n8n
- Live instance: **https://n8n-production-1286.up.railway.app** (Railway project "peaceful-trust",
  service `n8n`, deployment SUCCESS, Postgres backend, persistent volume, N8N_ENCRYPTION_KEY pinned,
  WEBHOOK_URL set, N8N_PROXY_HOPS set).
- The desktop n8n MCP fails auth ("invalid signature") — the public API with `X-N8N-API-KEY`
  (key in passwords.txt, `n8nCLAUDECLI api key`) works and is what `n8n/deploy.py` uses.
- **`$env` is BLOCKED inside nodes on this instance** ("access to env vars denied", 2026-09-08).
  Secrets go in credentials; the Twilio SIDs are placeholders injected by `n8n/deploy.py`.
- **The Postgres node splits the resolved Query Parameters string on commas** (observed
  2026-09-08). Writes take one base64(JSON) parameter and decode it in SQL.
- The public API cannot list credentials (only create/delete + schema); confirm ids by reading
  a workflow that uses them.
- **Live credential IDs (exported JSONs have STALE ids — never trust them):**
  Postgres/Supabase `WJrBNk44uOAqNA1S` ("Supabase Database")
  Slack OAuth2   `iuitfO3IOhFsxHWI` ("Slack account 3")
  Anthropic      `xjHVCv7P1iyoaRbr` (httpHeaderAuth)
  Slack Bearer   `28t8r7NccDmq8NVt` (httpBearerAuth)
- House rule: **the native Slack node has activation bugs — use HTTP Request + chat.postMessage +
  Bearer Auth instead.**
- `active` is read-only on the n8n API body — PUT to update, POST /activate to activate.
- Existing style: webhook -> Code -> (postgres|httpRequest) -> Code -> respondToWebhook,
  `settings: {"executionOrder":"v1"}`, kebab-case ids, human node names.
  Their exported files use OLD typeVersions (webhook 2, respondToWebhook 1.1) — USE CURRENT ONES BELOW.

## CURRENT n8n typeVersions (verified live 2026-08-28)
webhook 2.1 | respondToWebhook 1.4 | code 2 | httpRequest 4.3 | switch 3.3 | if 2.2 |
set 3.4 | googleSheets 4.7 | gmail 2.1 | twilio 1 | postgres 2.6
Webhook node output nests the POST body under `$json.body` — expressions are `$json.body.message...`

## Vapi (verified 2026-08-28)
- **Vapi Workflows (visual graph builder) were RETIRED 2026-08-18. Do not use. Build a single
  Assistant + tools.**
- Tool call payload Vapi POSTs: `{ message: { type:"tool-calls", toolCallList:[{id,name,arguments}], call:{...} } }`
  In n8n that is `$json.body.message.toolCallList[0]`. `arguments` may arrive as a JSON STRING — parse defensively.
- Required tool response: `{"results":[{"toolCallId":"<id>","result":"<string|object>"}]}` — **always HTTP 200**,
  even on business failure (put the error text in `result`).
- No `systemPrompt` field — system prompt is `model.messages[0]` with role "system".
- `server.timeoutSeconds` default 20. Tool `messages[]` types: request-start, request-response-delayed,
  request-complete, request-failed.
- Key tuning: `startSpeakingPlan.smartEndpointingPlan` (livekit), `transcriptionEndpointingPlan.onNumberSeconds`,
  `stopSpeakingPlan.numWords` (set 1-2 for noisy job-site callers), `acknowledgementPhrases`,
  `backgroundSpeechDenoisingPlan.smartDenoisingPlan.enabled`.
- `analysisPlan.structuredDataPlan.schema` for post-call extraction; `end-of-call-report` server message
  carries transcript, recording, analysis, cost.
- `api.vapi.ai` is behind Cloudflare and returns 403 `error code: 1010` to Python's default
  User-Agent — send a real one (deploy.py does).
- Free Vapi numbers: max 5 per org, US area codes only (704/980 were unavailable; 864 was),
  inbound only — "outbound calling not supported", which may include the transfer leg.
- Tool JSON schemas reject `dependentRequired`, `anyOf` and a top-level
  `parameters.description` (400). Keep those rules in the descriptions.
- Auth to tool servers: `server.headers` static shared secret is the simple path; credentialId/HMAC is the
  hardened path. n8n Webhook node "Header Auth" credential (`httpHeaderAuth`) validates before execution.
- Pricing: Vapi platform $0.05/min + pass-through STT/LLM/TTS/telephony. Realistic ~$0.17-0.19/min all-in.
  Default concurrency 10.

## Env vars that already exist in dr-squeegee
CAL_COM_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET,
TWILIO_MESSAGING_SERVICE_SID, TWILIO_SMS_TOKEN, TWILIO_PARSER_NUMBER, TWILIO_PARSER_TOKEN,
SMS_FROM_NUMBER, SMS_LIVE, SMS_TEST_TO, OWNER_PHONE, SLACK_BOT_TOKEN, RESEND_API_KEY,
SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CRM_PASSWORD, CRM_COOKIE_SECRET, CRON_SECRET,
GOOGLE_* (calendar), OPENAI_API_KEY.
`TWILIO_VOICE_TOKEN` is referenced in code but NOT in .env.local — it is set in Vercel only.

## Anthony's build rules (from .claude/rules/agents.md + Meridian/Decisions.md)
- No MVPs. Ship complete, quality, scalable. Full feature set in one pass.
- Opus orchestrates and reviews; Sonnet sub-agents do the building. Main agent never pushes directly.
- Never auto-launch agents on session resume — ask first.
- credential-guard.sh hook blocks commits touching .env/secret/credential files.
