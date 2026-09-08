# Dr. Squeegee after-hours voice agent — operator runbook

Live since 2026-09-08. `HANDOFF.md` has every id and what was verified; this is the
short version for running it day to day.

## How a missed call flows

```
caller → (980) 252-8701 → Twilio → drsqueegeeclt.com/api/twilio/voice
       → rings Anthony's cell for RING_SECONDS (20)
       → answered → done
       → no answer → Twilio dials +1 864 727 5081 (the Vapi number) with the
         caller's own number as caller ID → the assistant answers
       → tools → n8n webhooks → Cal.com / Supabase / Slack DM / SMS to Anthony
       → hang-up → end-of-call report → Slack DM summary (outcome, cost, recording)
```

## The one test only you can run — do it first

Call **(980) 252-8701** from a phone that is not your cell and let it ring out.

1. **Did the AI pick up, or your voicemail?** If voicemail: carrier voicemail beat the
   20-second ring. Set `RING_SECONDS=15` on the dr-squeegee Vercel project (no deploy
   needed) and try again.
2. **Did it greet you by name?** It should, if your number is in the CRM (it is —
   "Test Ferg"). If it greets everyone as a stranger, Twilio refused the caller-ID
   passthrough; tell Claude, the fallback is a one-line route change.
3. Ask for a window quote — 18 windows, one story, outside only. It must say
   **two hundred dollars** (the job minimum, not one hundred twenty-six).
4. Ask about gutters. It must refuse to give a number and offer an on-site look.
5. Ask what's open this week, pick a slot, give a name and the address. Then check:
   Cal.com (and your Google Calendar), `/crm/jobs`, `/crm/clients`, your Slack DMs,
   your texts. Delete the test job and client from the CRM afterwards and cancel the
   Cal.com booking.
6. Say "I want to talk to a person." It will try a warm transfer to your cell. Vapi's
   free numbers may not be allowed to place that leg — if it fails, it should say so
   and take your number instead. Tell Claude either way.
7. Hang up mid-sentence. The Slack end-of-call summary should still arrive.

## Knobs (no deploy needed)

| Knob | Where | Effect |
|---|---|---|
| `RING_SECONDS` | Vercel → dr-squeegee → env | how long your cell rings before hand-off (default 20) |
| `VAPI_PHONE_NUMBER` | Vercel → dr-squeegee → env | override the hand-off number; **set to an empty string to turn the agent off** (callers get the old "text us" message) |
| Voice | `python voice-agent/vapi/deploy.py` with `VAPI_VOICE_ID=<cartesia id>` | current: Cartesia "Iris — Friendly Specialist". Preview voices in the Vapi dashboard → Voice Library → Cartesia; any id works. |
| `SMS_LIVE` | Vercel → dr-squeegee → env | unrelated to the agent (it only texts you), but it is the switch for customer texts from the CRM |

## Where to look when something is off

- **n8n executions** (n8n → Executions, filter by "Vapi Tool …"): every tool call is
  one execution with the full Vapi payload and each node's output. A tool that
  "does nothing" is almost always an inactive workflow or a wrong secret (403).
- **Vapi dashboard → Calls**: transcript, recording, per-call cost, which tools fired.
- **Slack DM summaries**: one per call, with outcome, length, cost, ended reason.
- **Costs**: about $0.17–0.19 per minute all-in; a four-minute booking call ≈ 75¢.

## Redeploying after a change

```bash
cd voice-agent/n8n  && python validate.py && node test-nodes.js
N8N_API_KEY=… TWILIO_ACCOUNT_SID=… TWILIO_MESSAGING_SERVICE_SID=… python deploy.py   # upserts + activates all six

cd ../vapi && python validate.py
VAPI_PRIVATE_KEY=… VAPI_SERVER_SECRET=… VAPI_VOICE_ID=… VAPI_PHONE_NUMBER=+18647275081 python deploy.py
```
Keys live in `AI_Training/passwords.txt`. The route deploys with the repo as usual.

## Known gaps, deliberately left

- No reschedule tool — captured as a lead with `reason: reschedule_request`.
- `squeegee_leads` has no notes/reason column — context is in `squeegee_activity`
  and the alerts.
- Shared-secret auth, not HMAC.
- Nothing texts the *customer* from this flow yet; the assistant promises only that
  Anthony will follow up.
