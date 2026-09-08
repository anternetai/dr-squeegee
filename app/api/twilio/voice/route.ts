import { NextRequest, NextResponse } from "next/server";

/**
 * Twilio inbound-voice webhook for the Dr Squeegee business line (+1 980 252 8701).
 *
 * Call flow:
 *   1. Twilio hits this route (POST) on every inbound call to the business line
 *      -- this is the "A call comes in" webhook configured on the number in the
 *      Twilio console, and it never changes.
 *   2. We <Dial> Anthony's cell for up to 25s, with `action` pointed back at this
 *      same route so Twilio tells us how that dial went.
 *   3. If Anthony answered, we hang up cleanly -- he's on the line, we're done.
 *   4. If Anthony did NOT answer (no-answer / busy / failed / canceled), the
 *      call is still live and waiting on us. THIS is the missed-call gap: we
 *      now hand that live call off to the Vapi after-hours assistant instead
 *      of just telling the caller to text. That hand-off gets its OWN action
 *      round-trip (leg=vapi) so we can tell a genuine Vapi failure apart from
 *      a normal, completed AI conversation -- see missedCallTwiml() below for
 *      why that distinction needs its own branch instead of a bare trailing
 *      <Say>.
 *
 * Auth: every hit -- the first one and both action callbacks -- is gated by a
 * `?token=` query param checked against TWILIO_VOICE_TOKEN. There's no Twilio
 * request-signature validation available in front of this route, so this
 * shared secret is what stands between it and the open internet. This was
 * already true before this change and is untouched here.
 */

const BUSINESS_NUMBER = "+19802528701";
const ANTHONY_CELL = "+19802428048";

/**
 * The Vapi-held number the after-hours assistant answers on (free Vapi number,
 * created 2026-09-08, id ed04ba43-9e10-451d-bec5-667251a35bde). Callers never
 * see it -- it is only the target of the hand-off <Dial> below. Like the two
 * numbers above it is a constant, not a secret. VAPI_PHONE_NUMBER in Vercel
 * overrides it; set that var to an EMPTY string to switch the hand-off off
 * without a deploy (callers then hear the "text us" message as before).
 */
const DEFAULT_VAPI_NUMBER = "+18647275081";

/**
 * How long to ring Anthony's cell before handing the call to the AI.
 *
 * This number is load-bearing and easy to get wrong. Carrier voicemail on a
 * mobile typically picks up somewhere around 20-30s, and when it does, Twilio
 * reports DialCallStatus="completed" -- voicemail *answered* the call. From
 * this route's point of view that is indistinguishable from Anthony picking
 * up, so the AI never runs and the caller lands in a personal voicemail box.
 * Ringing for less time than the carrier's voicemail delay is what keeps the
 * missed-call path actually reachable. 20s is a safe default; lower it if
 * calls still fall into voicemail, raise it if Anthony wants longer to grab
 * the phone. Override with RING_SECONDS in Vercel without a code change.
 */
const RING_SECONDS = Number(process.env.RING_SECONDS) || 20;

// The one thing about this call a caller ever controls that lands back in our
// own TwiML is their `From` number (used as the callerId on the Vapi leg, see
// below) -- escape it before it goes anywhere near XML.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(body: string): NextResponse {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function forbidden(): NextResponse {
  return new NextResponse("Forbidden", { status: 403 });
}

function hangupTwiml(): NextResponse {
  return twiml("<Hangup/>");
}

// Same wording Twilio callers have always heard when a call couldn't be
// completed live -- kept as one constant so the "Vapi is unset" fallback and
// the "Vapi itself didn't pick up" fallback never drift apart.
const TEXT_US_MESSAGE =
  "We're sorry we missed your call. Please send us a text message and we'll get right back to you.";

/** First hit for a fresh inbound call: ring Anthony's cell. */
function dialAnthonyTwiml(token: string): NextResponse {
  // escapeXml here isn't about untrusted input (token and the literal path are
  // ours) -- it's because this URL has two query params joined by a bare `&`,
  // and a raw `&` inside an XML attribute value is invalid XML. `&amp;` is.
  const action = escapeXml(`/api/twilio/voice?token=${encodeURIComponent(token)}&leg=anthony`);
  return twiml(
    `<Dial callerId="${BUSINESS_NUMBER}" timeout="${RING_SECONDS}" action="${action}" method="POST">${ANTHONY_CELL}</Dial>`
  );
}

/**
 * Anthony didn't pick up. This is the gap Vapi fills.
 *
 * If VAPI_PHONE_NUMBER is configured, we <Dial> that number, passing the
 * ORIGINAL caller's number as callerId. Twilio's own docs on the Dial verb
 * explicitly allow this: callerId may be "the To or From number provided in
 * Twilio's TwiML request to your app" -- so this is supported caller-ID
 * passthrough for a forwarded call, not a workaround. Doing this means the
 * Vapi assistant's lookup_caller tool sees who is really calling and can
 * recognize a returning customer, instead of greeting everyone as a stranger.
 *
 * That inner Dial gets its OWN `action` callback (leg=vapi) rather than a
 * bare trailing <Say>. That's deliberate, not decoration: per Twilio's TwiML
 * docs, if a <Dial> has NO action attribute, whatever verb comes right after
 * it in the same <Response> runs on EVERY outcome -- including a full,
 * successful, multi-minute conversation that Vapi handled perfectly and hung
 * up on its own. A bare trailing <Say> would replay "sorry we couldn't
 * connect you" right after a call that went fine. Routing the outcome back
 * through this route (see the `leg=vapi` branch in POST, and
 * vapiOutcomeTwiml() below) lets us check DialCallStatus and only speak the
 * fallback message when Vapi genuinely never answered -- so the caller never
 * hears silence AND never hears a false "sorry" after a good call.
 *
 * If the number resolves to empty (VAPI_PHONE_NUMBER="" in Vercel), we fall
 * back to the original "text us instead" message -- that is the kill switch.
 *
 * Alternative not used here: skip the second phone number entirely and route
 * straight into Vapi over SIP with a BYO trunk --
 *   <Dial><Sip>sip:+19802528701@<credentialId>.sip.vapi.ai</Sip></Dial>
 * -- which avoids a second telephony leg (and its cost) instead of dialing a
 * Vapi-owned number. See twilio-voice-route.NOTES.md for the full trade-off;
 * left as a comment here for whoever revisits this.
 */
function missedCallTwiml(token: string, callerFrom: string): NextResponse {
  const vapiNumber = process.env.VAPI_PHONE_NUMBER ?? DEFAULT_VAPI_NUMBER;

  if (!vapiNumber) {
    return twiml(`<Say>${escapeXml(TEXT_US_MESSAGE)}</Say>`);
  }

  // Twilio sends From="anonymous" (or another non-E.164 token) for a withheld
  // caller ID; passing that through as callerId fails the Dial outright (Twilio
  // error 13214) and the caller never reaches the assistant. Pass through only a
  // real E.164 number, otherwise present the business line.
  const callerId = /^\+[1-9]\d{7,14}$/.test(callerFrom) ? callerFrom : BUSINESS_NUMBER;
  // Same reason as dialAnthonyTwiml's `action`: escape the joined query
  // string's bare `&` to `&amp;` so this stays valid XML.
  const action = escapeXml(`/api/twilio/voice?token=${encodeURIComponent(token)}&leg=vapi`);
  return twiml(
    `<Dial callerId="${callerId}" timeout="15" action="${action}" method="POST">${escapeXml(vapiNumber)}</Dial>`
  );
}

/** Vapi's own leg finished -- either it handled the whole call, or it never picked up. */
function vapiOutcomeTwiml(dialCallStatus: string | null): NextResponse {
  if (dialCallStatus === "completed" || dialCallStatus === "answered") {
    // Vapi answered and ran the whole conversation; it already said goodbye
    // and hung up. Nothing left to say -- just close out the call.
    return hangupTwiml();
  }
  // Vapi itself didn't pick up (misconfigured number, outage, etc). This is
  // the genuine "Vapi failed" case -- the caller must not hear silence.
  return twiml(`<Say>${escapeXml(TEXT_US_MESSAGE)}</Say>`);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  // The `token === null` check is written out explicitly (rather than relying
  // on `null !== someString` alone) purely so TypeScript narrows `token` to
  // `string` for the rest of this function -- behavior is identical either
  // way, a missing token was always rejected here.
  if (token === null || token !== process.env.TWILIO_VOICE_TOKEN) {
    return forbidden();
  }

  // A bodyless request (a GET probe, a retry with the wrong content-type) makes
  // formData() throw; that must not turn into a 500, which Twilio reads out as
  // "an application error has occurred" and drops the call.
  const form = await req.formData().catch(() => null);
  const dialCallStatus = form?.get("DialCallStatus")?.toString() ?? null;
  const from = form?.get("From")?.toString() ?? "";
  const leg = url.searchParams.get("leg");

  // First hit for this call: nothing has been dialed yet, so there's no
  // DialCallStatus at all. Ring Anthony.
  if (dialCallStatus === null) {
    return dialAnthonyTwiml(token);
  }

  // Callback from our OWN Vapi hand-off leg (see missedCallTwiml above).
  if (leg === "vapi") {
    return vapiOutcomeTwiml(dialCallStatus);
  }

  // Otherwise this is the callback from the original Anthony-cell dial.
  if (dialCallStatus === "completed" || dialCallStatus === "answered") {
    return hangupTwiml();
  }

  // THE GAP: Anthony missed it. Hand the still-live call to Vapi (or the
  // safe "text us" fallback if VAPI_PHONE_NUMBER isn't configured yet).
  return missedCallTwiml(token, from);
}

// The route this replaces handled GET as well as POST. Twilio uses POST for
// both the number's "A call comes in" webhook and our own `action` callbacks,
// but if the number is ever configured as GET -- or was historically -- losing
// this export would silently 405 every inbound call. Kept deliberately.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
