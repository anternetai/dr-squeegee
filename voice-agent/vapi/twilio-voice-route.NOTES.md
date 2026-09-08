# Missed-call handoff: two ways to reach Vapi, and what to do for each

`twilio-voice-route.patch.ts` is the complete new contents of
`app/api/twilio/voice/route.ts`. Only the missed-call (else) branch changed —
everything about the token auth, the 25s dial to Anthony's cell, and the
`completed|answered -> <Hangup/>` behavior is preserved exactly. This file
covers the two ways to actually connect that branch to Vapi, since only one
is implemented in the code.

## Approach A (implemented): dial a Vapi phone number

The missed-call branch does a second Twilio `<Dial>` — same mechanism already
used to ring Anthony's cell — to a phone number that belongs to Vapi, held in
a new env var `VAPI_PHONE_NUMBER`. Twilio bridges the still-live caller to
that number; Vapi answers and the assistant takes over. The original caller's
number is passed through as `callerId` on that `<Dial>` (Twilio's docs
explicitly allow the inbound call's own `From` as a forwarded call's
`callerId`), so the assistant's `lookup_caller` tool sees the real caller ID.

**Trade-off:** this is a full second telephony leg — Twilio charges for the
inbound minutes AND for this outbound leg to Vapi's number, on top of Vapi's
own per-minute pricing. For a low-volume business this is a few cents per
missed call, not worth optimizing away. In exchange, setup is minimal and
nothing about the existing Twilio number configuration changes.

**What Anthony needs to do:**

1. **In Vapi:** Phone Numbers → Create Phone Number. Either let Vapi issue a
   free Vapi-hosted number, or buy a small second Twilio number and import it
   via "Import Twilio" (Account SID + Auth Token). Either way this must be a
   *different* number from the business line +1 980 252 8701 — don't reuse it.
2. **In Vapi:** assign the Dr Squeegee — After Hours assistant (from
   `assistant.json`) to that number as its inbound assistant.
3. **In Vercel:** add `VAPI_PHONE_NUMBER` as an env var on the dr-squeegee
   project, set to that number in E.164 (e.g. `+19195551234`), and redeploy.
4. Nothing to change in the Twilio console — the existing "A call comes in"
   webhook on +1 980 252 8701 already points at this same route and stays
   exactly as-is.

Until step 3 is done, `VAPI_PHONE_NUMBER` is unset and the route falls back to
the original "please send us a text" message — so this ships safely today,
before the Vapi number exists.

## Approach B (not implemented, left as a comment): BYO SIP trunk

Skip the second phone number and route straight into Vapi over SIP:

```
<Dial><Sip>sip:+19802528701@<credentialId>.sip.vapi.ai</Sip></Dial>
```

Here `+19802528701` isn't a number being billed for airtime — it's just an
identifier telling Vapi which of Anthony's configured numbers/assistants to
route to, and `<credentialId>` is a SIP trunk credential created in Vapi
(`byo-sip-trunk` type). This is a **single** telephony leg: Twilio hands the
call to Vapi directly over SIP signaling instead of placing a second phone
call, so there's no second per-minute leg to pay for, and the business's
Twilio number never has to change.

**Trade-off:** meaningfully more setup, and it's account-wide plumbing, not a
one-line env var. It needs a SIP trunk credential created in Vapi via the API
(with Twilio's signaling IPs allowlisted for inbound), and either a Twilio
Elastic SIP Trunk with an Origination URI pointed at Vapi, or this inline
`<Dial><Sip>` verb used instead of `<Dial><Number>`. It's the better choice
once call volume is high enough that the extra telephony leg's cost actually
matters, or if Anthony wants everything to stay on the one business number
end-to-end with no second number to keep track of. For where this business
is today — low-volume, one number, one missed-call path — Approach A is
simpler to stand up and to reason about later, which is why it's what's
implemented.

**If Anthony ever wants to switch to this:** update Vapi's SIP trunk
credential and the destination's `<Sip>` element the code currently doesn't
have, remove the `VAPI_PHONE_NUMBER` env var path, and this NOTES file is the
pointer for whoever picks that up.
