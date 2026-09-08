# Voice agent — state of the build

Read this first. It is written for whoever picks this up next (human or agent).

**Goal:** Dr. Squeegee misses inbound calls. When (980) 252-8701 rings out to
Anthony's cell unanswered, a Vapi assistant picks up, qualifies the caller, quotes
from real pricing, books on Cal.com, captures leads, and texts Anthony.

**History:** built 2026-08-28 in a Cowork session that could not reach `api.vapi.ai`,
`api.cal.com`, or n8n, so nothing was ever run. Wired, reviewed, tested against the
live services, fixed, and shipped on 2026-09-08 (Fable 5.1). Everything below was
observed this session, not assumed.

---

## What is live

| Piece | Where | Id / value |
|---|---|---|
| Vapi assistant "Dr Squeegee — After Hours" | api.vapi.ai | `cb6eafab-1adf-4c8f-b776-6612101d2b96` |
| Vapi tools (5) | api.vapi.ai | lookup_caller `b67f967e…`, quote_service `2b81d053…`, check_availability `cd241dd5…`, book_job `d3dc1465…`, capture_lead `aa05c260…` |
| Vapi phone number (free, hand-off target only) | api.vapi.ai | **+1 864 727 5081** — id `ed04ba43-9e10-451d-bec5-667251a35bde`, assigned to the assistant. 704/980 were not available for free numbers; callers never see this number. |
| 6 n8n workflows, all **active** | n8n on Railway | Book Job `62sss62CFk9V3qzY` · Capture Lead `nTnBuQhxRqaT0qdo` · Check Availability `tWmBB0eqsvKThJTw` · End of Call `ibmGCgcfdHSsJocD` · Lookup Caller `mycaDVC4x3lKgU5Z` · Quote Service `3UvxtJtexCFYbu3l` |
| n8n credentials | n8n | Vapi Tool Secret `wycoqjtM2qevxil3` (Header Auth `x-vapi-secret`) · Twilio API Key (Dr Squeegee AC1ee98) `Sm4NXmuBaNMtJ9WN` · Cal.com API Key (drsqclt) `6N8Gw12AStkWa9P3` · Supabase Database `WJrBNk44uOAqNA1S` · Slack Bearer Token `28t8r7NccDmq8NVt` |
| Shared secret | `AI_Training/passwords.txt` → `VAPI_SERVER_SECRET` | same value in the n8n credential and in every Vapi tool's `server.headers` |
| Twilio route | `app/api/twilio/voice/route.ts` | no-answer → `<Dial callerId={caller}>` the Vapi number, own `leg=vapi` action callback. Default number is a constant; `VAPI_PHONE_NUMBER` in Vercel overrides it, **empty string = kill switch**. `RING_SECONDS` (default 20) is the other knob. |

All three Twilio numbers on the account (980-252-8701, 704-286-9696, 704-378-8962)
point their voice webhook at this same route, so a missed call on any of them hands
off the same way.

## What was verified this session

- 52 node-level tests over every Code node (`n8n/test-nodes.js`) — pricing floors
  and rounding, DST offsets on both sides of the boundary, noon/afternoon speech,
  JSON-string `arguments`, invalid requests, DB-down paths.
- Live webhook calls with the real secret: wrong secret → 403; quote 18 windows →
  "two hundred dollars"; gutters → no figure; unknown caller → "No client record";
  availability → real Cal.com slots with `[appointmentDate, appointmentTime]` tags;
  **book_job → real Cal.com booking + `squeegee_clients` row (consent recorded) +
  `squeegee_jobs` row linked by `client_id` + activity + Slack DM `ok:true` + SMS
  `accepted` to Anthony**; capture_lead → `squeegee_leads` row + activity + Slack + SMS;
  invalid booking (no name) → refused before Cal.com is touched. Test bookings were
  cancelled on Cal.com and every test row deleted afterwards.
- Vapi Chat API against the deployed assistant: it called `quote_service`, n8n
  answered, and it replied "That would be two hundred dollars for cleaning the
  outside of those eighteen windows." — the whole tool loop, no phone needed.
- `tsc` and `eslint` clean on the route; Vercel deploy READY; prod probe of the
  no-answer branch returns the Vapi `<Dial>`.

## Bugs found in the 8/28 build and fixed here

1. **Window quotes never priced on a real call.** The tool schema sends
   `windowCounts.story1/2/3`; the Code node only read `"1"/"2"/"3"`. The runbook's
   curl example used the legacy keys, which is why it "passed". Both accepted now.
2. **Booking and lead alerts read fields off the Postgres RETURNING row** that don't
   exist there — Slack/SMS would have said `undefined` for name, phone, address, time;
   the lead alert threw on `reason.replace`. They now read the parsed request.
3. **Comma splitting.** This n8n build splits the *resolved* Query Parameters string on
   commas, so "123 Maple St, Charlotte, NC 28205" shifted every bind parameter
   (observed: `invalid input syntax for type date: "outside only"`). Every Postgres
   write now takes one base64(JSON) parameter decoded in SQL.
4. **`$env` is blocked in nodes on this instance** ("access to env vars denied"). Cal.com
   auth moved to a Header Auth credential; the Twilio SIDs are `REPLACE_ME_*` placeholders that
   `n8n/deploy.py` injects from `TWILIO_ACCOUNT_SID` / `TWILIO_MESSAGING_SERVICE_SID` (GitHub push
   protection blocks an Account SID in this public repo); the owner number is a constant.
   The three Railway vars set earlier (`CAL_COM_API_KEY`, `TWILIO_ACCOUNT_SID`,
   `TWILIO_MESSAGING_SERVICE_SID`) are unused and can be removed.
5. **Noon spoke as "twelve in the evening".** Fixed in the shared prelude.
6. **Availability told the model to pass an ISO string `book_job` has no parameter
   for.** Slots now carry the exact `appointmentDate`/`appointmentTime` to hand over.
7. **A booking with no customer.** `book_job` inserted a job with `client_id` NULL — the
   same class as the 7/31 doors bug. It now upserts `squeegee_clients` by phone,
   records verbal SMS consent when given, and links the job.
8. **Cal.com was called before the request was validated.** Gated now; a request
   missing name/address/time never touches the calendar.
9. **Promises the system doesn't keep.** The prompt and tool results said "Anthony
   will text a confirmation" / "that's on its way to you" — nothing texts the customer
   from this flow (and `SMS_LIVE` is still false). Wording now says he'll follow up.
10. Vapi rejects `dependentRequired`, `anyOf`, and a `parameters.description` in tool
    schemas; the constraints live in the descriptions instead.

## Not verified — needs a real phone call (Anthony)

- **Caller-ID passthrough** on the hand-off `<Dial>` (Twilio permits the inbound
  `From` as `callerId` for a forwarded call; if it rejects it, the Dial fails and the
  caller hears the old "text us" message — never silence).
- **Ring timeout vs. carrier voicemail.** 20s default. If a test call lands in
  Anthony's personal voicemail, lower `RING_SECONDS` in Vercel; no deploy needed.
- **Warm transfer to Anthony's cell from a free Vapi number.** Vapi's free numbers
  "do not support outbound calling"; the transfer leg may be refused. The prompt now
  falls back to capture_lead if the transfer does not connect.
- **Voice.** Cartesia "Iris — Friendly Specialist" (`c894559e-d529-4d70-a6fb-3330ecf7ef6b`)
  was picked so the pipeline could be tested end to end. Swapping is one command —
  see RUNBOOK. Anthony's call.

## Operating it

```bash
cd voice-agent/n8n  && python validate.py && node test-nodes.js      # static + behavioural
cd voice-agent/vapi && python validate.py                             # schemas, prompt sync, no secrets
N8N_API_KEY=… TWILIO_ACCOUNT_SID=… TWILIO_MESSAGING_SERVICE_SID=… python voice-agent/n8n/deploy.py   # upsert + activate the six
VAPI_PRIVATE_KEY=… VAPI_SERVER_SECRET=… VAPI_VOICE_ID=… VAPI_PHONE_NUMBER=+18647275081 \
  python voice-agent/vapi/deploy.py                                   # upsert tools + assistant + number
```

`api.vapi.ai` sits behind Cloudflare and rejects Python's default User-Agent (error
1010) — the deploy script sets one. n8n's public API cannot list credentials; the ids
above were confirmed by reading workflows that use them.

## Things that will still bite you

- **Tool webhooks must always return HTTP 200** with
  `{"results":[{"toolCallId":"…","result":"…"}]}`. Business failures go in `result`.
- **n8n nests the webhook body**: `$json.body.message.toolCallList[0]`; `arguments`
  sometimes arrives as a JSON string.
- **Postgres node Query Parameters split on commas** — never pass caller text as a
  bare `{{ }}` parameter; use the base64 transport the write nodes use.
- **Cal.com v2 `cal-api-version` differs per resource** (event-types `2024-06-14`,
  slots `2024-09-04`, bookings `2024-08-13`). A wrong value silently changes the shape.
- **Double calendar events.** The agent books through Cal.com only and leaves
  `google_calendar_event_id` NULL. Don't "fix" that by also calling
  `lib/google-calendar.ts`.
- **`SMS_LIVE` is still `false`.** The agent only texts Anthony (direct Twilio REST,
  not `lib/squeegee/sms.ts`), so nothing is blocked; customer texting stays his call.
- **Pricing constants are mirrored** in the Quote Service Code node from
  `lib/squeegee/pricing.ts`. Change one, change both, run `test-nodes.js`.

## Open decisions for Anthony

- Voice (above). Ring timeout (above). Flip `SMS_LIVE`.
- **No reschedule tool.** Existing customers wanting to move an appointment are
  captured as a lead with `reason: reschedule_request`.
- **`squeegee_leads` has no `notes`/`reason` column** — agent context goes to
  `squeegee_activity` plus the alerts. An additive migration would make it first-class.
- **Shared-secret auth, not HMAC.** Fine for one internal integration.
- Remove the three unused Railway env vars on the n8n service.
