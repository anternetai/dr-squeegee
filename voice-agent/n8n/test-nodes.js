// Executes every Code node's jsCode from the vapi-*.json workflows against realistic payloads: node test-nodes.js
// Emulates the two n8n globals the nodes use: $input.first() and $('Node Name').first().
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

function code(file, nodeName) {
  const wf = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const n = wf.nodes.find(x => x.name === nodeName);
  if (!n) throw new Error('no node ' + nodeName);
  return n.parameters.jsCode;
}
function run(file, nodeName, inputJson, others = {}) {
  const js = code(file, nodeName);
  const $input = { first: () => ({ json: inputJson }) };
  const $ = (name) => ({ first: () => { if (!(name in others)) throw new Error('node ' + name + ' did not run'); return { json: others[name] }; } });
  const fn = new Function('$input', '$', js);
  const out = fn($input, $);
  return out[0].json;
}
const tool = (name, args, extra = {}) => ({ body: { message: { type: 'tool-calls', toolCallList: [{ id: 'tc1', name, arguments: args }], call: { id: 'call-1', customer: { number: '+19805551212' } }, ...extra } } });
const res = (r) => r.results[0].result;

let fails = 0;
function expect(label, actual, pred) {
  const ok = typeof pred === 'function' ? pred(actual) : actual === pred;
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (ok ? '' : '\n      got: ' + JSON.stringify(actual)));
  if (!ok) fails++;
}

// ---------------- quote-service
const Q = 'vapi-quote-service.json', QN = 'Compute Quote';
expect('18 story1 exterior -> $200 floor', res(run(Q, QN, tool('quote_service', { serviceType: 'window_cleaning', windowCounts: { story1: 18 }, coverage: 'exterior' }))), s => s.startsWith('Estimate: two hundred dollars total'));
expect('10 story1 + 8 story2 exterior -> $200 (raw 142.8)', res(run(Q, QN, tool('quote_service', { windowCounts: { story1: 10, story2: 8 }, coverage: 'exterior' }))), s => s.includes('two hundred dollars total') && s.includes('18 windows'));
expect('30 story1 both -> $380', res(run(Q, QN, tool('quote_service', { windowCounts: { story1: 30 }, coverage: 'both' }))), s => s.includes('three hundred eighty dollars total'));
expect('legacy "1":18 keys still work', res(run(Q, QN, tool('quote_service', { windowCounts: { '1': 18 }, coverage: 'exterior' }))), s => s.includes('two hundred dollars total'));
expect('house wash 2-story-large -> $475', res(run(Q, QN, tool('quote_service', { serviceType: 'house_wash', houseWashTier: '2-story-large' }))), s => s.includes('four hundred seventy-five dollars total'));
expect('driveway 800 sqft -> $160', res(run(Q, QN, tool('quote_service', { serviceType: 'driveway', sqft: 800, sqftService: 'Driveway' }))), s => s.includes('one hundred sixty dollars total'));
expect('gutters -> no figure', res(run(Q, QN, tool('quote_service', { serviceType: 'gutter_cleaning' }))), s => s.startsWith('No set price for gutter cleaning') && !/\d/.test(s));
expect('arguments as JSON string', res(run(Q, QN, tool('quote_service', JSON.stringify({ windowCounts: { story1: 18 }, coverage: 'exterior' })))), s => s.includes('two hundred dollars total'));
expect('bundle windows + house -> $500', res(run(Q, QN, tool('quote_service', { services: [{ windowCounts: { story1: 10, story2: 8 }, coverage: 'exterior' }, { houseWashTier: '1-story-standard' }] }))), s => s.includes('five hundred dollars total'));
expect('1475 spelled', res(run(Q, QN, tool('quote_service', { sqft: 5900, sqftService: 'Pavers' }))), s => s.includes('one thousand four hundred seventy-five dollars'));
expect('window_cleaning with no counts -> asks', res(run(Q, QN, tool('quote_service', { serviceType: 'window_cleaning' }))), s => s.startsWith('Not enough detail yet for window cleaning'));

// ---------------- check-availability
const A = 'vapi-check-availability.json';
const todayET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const pa = run(A, 'Parse Tool Call', tool('check_availability', { startDate: '2020-01-01', daysToSearch: 5 }));
expect('past startDate clamps to today', pa.startDate, todayET);
const pa2 = run(A, 'Parse Tool Call', tool('check_availability', { startDate: '2026-12-01', daysToSearch: 5 }));
expect('endDate = start + days', pa2.endDate, '2026-12-06');
const slots = { status: 'success', data: {
  '2026-09-10': [{ start: '2026-09-10T12:00:00.000-04:00' }, { start: '2026-09-10T15:00:00.000-04:00' }],
  '2026-09-11': [{ start: '2026-09-11T09:00:00.000-04:00' }],
  '2026-09-12': [{ start: '2026-09-12T17:00:00.000-04:00' }] } };
const fs1 = res(run(A, 'Format Slots', slots, { 'Resolve Event Type': { toolCallId: 'tc1', eventTypeId: 6358639 } }));
console.log('   availability text: ' + fs1);
expect('noon is afternoon', fs1, s => s.includes('Thursday, September 10 at 12 in the afternoon'));
expect('date/time pairs present', fs1, s => s.includes('[appointmentDate 2026-09-10, appointmentTime 12:00]') && s.includes('[appointmentDate 2026-09-11, appointmentTime 09:00]') && s.includes('[appointmentDate 2026-09-12, appointmentTime 17:00]'));
expect('5pm is evening', fs1, s => s.includes('5 in the evening'));
const jan = { data: { '2027-01-12': [{ start: '2027-01-12T14:00:00.000-05:00' }] } };
expect('DST-off January slot 2pm', res(run(A, 'Format Slots', jan, { 'Resolve Event Type': { toolCallId: 'tc1', eventTypeId: 1 } })), s => s.includes('at 2 in the afternoon [appointmentDate 2027-01-12, appointmentTime 14:00]'));
expect('slots API error -> calendar unreachable', res(run(A, 'Format Slots', { error: { message: 'timeout' } }, { 'Resolve Event Type': { toolCallId: 'tc1', eventTypeId: 1 } })), s => s.startsWith('I could not reach the calendar'));
expect('no slots -> graceful', res(run(A, 'Format Slots', { data: {} }, { 'Resolve Event Type': { toolCallId: 'tc1', eventTypeId: 1 } })), s => s.startsWith('Nothing open'));
expect('event type missing -> graceful', res(run(A, 'Format Slots', {}, { 'Resolve Event Type': { toolCallId: 'tc1', eventTypeId: null } })), s => s.startsWith('I could not reach the calendar'));

// ---------------- book-job
const B = 'vapi-book-job.json';
const bookArgs = { callerName: 'Test Voiceagent', phoneNumber: '+19805551212', serviceAddress: '123 Maple St, Charlotte, NC 28205', servicesRequested: ['window cleaning, outside only, 2-story'], quotedPriceUsd: 200, appointmentDate: '2026-09-10', appointmentTime: '09:00', notes: 'gate code 1234', smsConsent: true };
const pb = run(B, 'Parse Booking Request', tool('book_job', bookArgs));
expect('startISO with ET offset (DST)', pb.startISO, '2026-09-10T09:00:00-04:00');
expect('valid', pb.valid, true);
expect('quotedPriceText', pb.quotedPriceText, '200');
expect('spoken', pb.spoken, 'Thursday, September 10 at 9 in the morning');
expect('phone e164', pb.customerPhone, '+19805551212');
const pbJan = run(B, 'Parse Booking Request', tool('book_job', { ...bookArgs, appointmentDate: '2027-01-12', appointmentTime: '14:00' }));
expect('January -> -05:00', pbJan.startISO, '2027-01-12T14:00:00-05:00');
const pbBad = run(B, 'Parse Booking Request', tool('book_job', { ...bookArgs, callerName: '' }));
expect('missing name -> invalid', pbBad.valid, false);
const pbNoPrice = run(B, 'Parse Booking Request', tool('book_job', { ...bookArgs, quotedPriceUsd: undefined }));
expect('no price -> empty text', pbNoPrice.quotedPriceText, '');
const mb = run(B, 'Merge Booking Result', { status: 'success', data: { uid: 'abc123' } }, { 'Parse Booking Request': pb });
expect('calOk true on uid', mb.calOk && mb.calBookingUid === 'abc123', true);
const jobPayload = JSON.parse(Buffer.from(mb.jobPayloadB64, 'base64').toString('utf8'));
expect('job payload carries comma address + uid + consent', jobPayload.address === '123 Maple St, Charlotte, NC 28205' && jobPayload.cal_uid === 'abc123' && jobPayload.sms_consent === true && jobPayload.price === '200' && jobPayload.appt_time === '09:00', true);
expect('b64 has no commas', /,/.test(mb.jobPayloadB64), false);
const mbErr = run(B, 'Merge Booking Result', { error: { message: 'slot taken' } }, { 'Parse Booking Request': pb });
expect('calOk false on error', mbErr.calOk, false);
expect('success response', res(run(B, 'Build Vapi Response', { id: 'job-uuid' }, { 'Merge Booking Result': mb })), s => s.startsWith('Booked for Thursday, September 10 at 9 in the morning at 123 Maple St'));
expect('cal ok but DB failed', res(run(B, 'Build Vapi Response', { error: 'db down' }, { 'Merge Booking Result': mb })), s => s.includes('Booked on the calendar') && s.includes('CRM record did not save'));
expect('failure: invalid request', res(run(B, 'Build Failure Response', pbBad, { 'Parse Booking Request': pbBad })), s => s.startsWith('I am missing something'));
expect('failure: slot taken', res(run(B, 'Build Failure Response', { ...mbErr, eventTypeId: 6358639 }, { 'Parse Booking Request': pb })), s => s.startsWith('That slot is no longer available'));
expect('failure: calendar unreachable -> no retry loop', res(run(B, 'Build Failure Response', { ...mbErr, eventTypeId: null }, { 'Parse Booking Request': pb })), s => s.includes('calendar could not be reached') && s.includes('Do not retry'));
expect('whitespace name -> invalid', run(B, 'Parse Booking Request', tool('book_job', { ...bookArgs, callerName: '   ' })).valid, false);

// ---------------- capture-lead
const L = 'vapi-capture-lead.json';
const pl = run(L, 'Parse Lead', tool('capture_lead', { callerName: 'Dave "Dizzy" O\'Neil', phoneNumber: '(704) 555-1212', servicesRequested: ['gutter cleaning', 'roof "soft" wash'], reason: 'needs_onsite_quote', notes: 'two-story, steep', callbackRequested: true, smsConsent: false }));
const leadPayload = JSON.parse(Buffer.from(pl.leadPayloadB64, 'base64').toString('utf8'));
expect('lead payload round-trips (quotes, commas)', leadPayload.services.join('|') + '#' + leadPayload.name, "gutter cleaning|roof \"soft\" wash#Dave \"Dizzy\" O'Neil");
expect('lead payload no consent', leadPayload.sms_consent === false && leadPayload.consent_at === '', true);
expect('phone normalised', pl.phone, '+17045551212');
expect('leadNote single string', Buffer.from(pl.leadNoteB64, 'base64').toString('utf8'), s => s.startsWith('Dave "Dizzy" O\'Neil — +17045551212 — gutter cleaning, roof "soft" wash. Reason: needs_onsite_quote Notes: two-story, steep Caller asked for a callback.'));
expect('consentAt empty when no consent', pl.consentAt, '');
const plNoPhone = run(L, 'Parse Lead', { body: { message: { toolCallList: [{ id: 't', name: 'capture_lead', arguments: { callerName: 'X', reason: 'other' } }], call: { customer: {} } } } });
expect('no phone -> hasPhone false', plNoPhone.hasPhone, false);
expect('lead response saved', res(run(L, 'Build Vapi Response', { id: 'lead-uuid' }, { 'Parse Lead': pl })), s => s.startsWith('Got it'));
expect('lead response db failed', res(run(L, 'Build Vapi Response', { error: 'x' }, { 'Parse Lead': pl })), s => s.startsWith('Details noted'));
expect('lead response no phone', res(run(L, 'Build Vapi Response', { id: 'x' }, { 'Parse Lead': plNoPhone })), s => s.startsWith('I still need a good callback number'));

// ---------------- lookup-caller
const K = 'vapi-lookup-caller.json';
const pk = run(K, 'Parse Tool Call', tool('lookup_caller', {}));
expect('phone10 from caller id', pk.phone10, '9805551212');
expect('blacklisted', res(run(K, 'Build Vapi Response', { client: { name: 'Bad Guy', blacklisted: true, blacklist_reason: 'no-pay' }, job: null, quote: null }, { 'Parse Tool Call': pk })), s => s.startsWith('DO NOT BOOK'));
expect('known client + open quote', res(run(K, 'Build Vapi Response', { client: { name: 'Jane Doe', address: '1 Main St', blacklisted: false, sms_consent: true }, job: { service_type: 'House Wash', status: 'complete' }, quote: { token: 'abc', total_price: 350 } }, { 'Parse Tool Call': pk })), 'Existing client: Jane Doe, 1 Main St. Already opted in to texts. Last job: House Wash, complete. Open quote for three hundred fifty dollars, still pending.');
expect('unknown caller', res(run(K, 'Build Vapi Response', { client: null, job: null, quote: null }, { 'Parse Tool Call': pk })), 'No client record for this number.');
expect('db error', res(run(K, 'Build Vapi Response', { error: 'x' }, { 'Parse Tool Call': pk })), s => s.startsWith('I could not reach our records'));

// ---------------- end-of-call
const E = 'vapi-end-of-call.json';
const eoc = { body: { message: { type: 'end-of-call-report', endedReason: 'customer-ended-call', durationSeconds: 251, cost: 0.71, call: { customer: { number: '+19805551212' } }, analysis: { summary: 'Caller booked windows.', structuredData: { outcome: 'booked', callerName: 'Test', servicesRequested: ['window cleaning'], quotedPriceUsd: 200, appointmentBooked: true, appointmentTime: 'Thu Sep 10 9am' } }, artifact: { recording: { mono: { combinedUrl: 'https://x/rec.wav' } } } } } };
const bs = run(E, 'Build Call Summary', eoc);
console.log('   slack text:\n' + bs.slackText.split('\n').map(l => '     | ' + l).join('\n'));
expect('report not skipped', bs.skip, false);
expect('ended reason in text', bs.slackText, s => s.includes('*Ended:* customer ended call') && s.includes('4.2 min') && s.includes('$0.71'));
expect('status-update skipped', run(E, 'Build Call Summary', { body: { message: { type: 'status-update' } } }).skip, true);

console.log(fails ? `\n${fails} FAILED` : '\nALL NODE TESTS PASSED');
process.exit(fails ? 1 : 0);
