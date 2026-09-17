# Backlog


## Crew Portal v2 — deferred at ship (2026-09-08)

Shipped in `5c3ad25`. These were found in review and deliberately not fixed.

- **Offline photo-upload queue.** `app/team/jobs/[id]/job-view.tsx` `PhotoRail.upload()`
  is a plain `fetch`; a failed upload surfaces an inline error rather than retrying.
  Nothing is silently lost, but there is no IndexedDB queue, and SPEC §6 step 4 called
  one load-bearing — a crew member on a bad-signal driveway is the normal case, not the
  exotic one. **Anthony's call: ship without it.** Adding an untested IndexedDB layer at
  review time was the bigger risk. Build it before a second crew member is hired.
- **PIN lockout is distinguishable from an unknown phone.** After 5 wrong PINs a real
  phone gets `429` + "Too many tries…"; an unknown phone always gets `401` + the generic
  failure. SPEC §4 asked for these to be indistinguishable. The leak is "given a phone
  number, learn whether that person works here" — self-limiting against a roster of one,
  since triggering it locks the real user out. **Anthony's call: leave as is.** Hiding it
  costs the crew a real explanation on a driveway; revisit if the roster grows.
- **Login scans up to 200 employees in JS.** `app/api/team/auth/login/route.ts` loads the
  roster and matches a normalized `phoneKey` in application code instead of querying a
  normalized phone column. Correct and fast at crew size 1–10; wrong shape at 50.
- **`openSegment()` ignores its insert error.** `lib/squeegee/crew.ts`. A double-tap that
  races the `squeegee_job_time_one_open_per_employee` unique partial index drops the
  segment silently — the index does stop the bad write, but the crew member gets no
  feedback that their timer did not start.
- **`POST /api/team/push/subscribe` accepts any `endpoint` string.** A logged-in crew
  member could point web-push at an arbitrary URL. Standard web-push SSRF surface, and
  the payload is encrypted, so the impact is low. Host-allowlisting is the hardening.
- **Doc drift: the service worker.** Served at `/team-sw.js` (from `public/team-sw.js`),
  not the `/team/sw.js` the spec names. Registration passes `{ scope: "/team" }`, which
  is legal because the script directory `/` covers `/team`. No code fix needed — fix the
  spec text.
- **`npm run lint` exits 1 on a pre-existing baseline: 29 errors / 42 warnings**, none of
  them in a file Crew Portal v2 touched (verified by intersecting the changeset with the
  eslint JSON report). Worst offenders: `app/review/review-client.tsx` (6),
  `components/squeegee/clients-table.tsx` (4), `components/ui/sidebar.tsx` (shadcn
  boilerplate calling `Math.random` in render). Vercel does not run eslint during
  `next build`, so this never blocks a deploy — which is exactly why it has been allowed
  to accumulate. Worth a lint-baseline gate like the one the anthill repo has.

## Crew PIN set/reset — deferred (2026-09-16)

- **/crm/team list has no "no PIN" badge.** An onboarded crew member with no PIN shows as
  plain Active in the list; the link only appears on their detail page. Add a badge on the
  card when the roster grows past one.
- **PIN reset does not revoke existing crew sessions.** `crew_session` is a stateless HMAC
  cookie (30 days); reset_pin wipes the PIN but a phone already logged in stays logged in.
  Fine for a forgotten PIN, wrong for a lost phone — add a session-version column if that
  case ever matters.

## Crew field flow v3 — deferred at ship (2026-09-16)

- **Owner alerts obey the opt-out list.** They go through `sendSms` (kind `crew_alert_owner`), so if Anthony
  ever texts STOP to the business line his own crew alerts go silently dead. Exempt the owner number for
  that kind, or surface "blocked" on the CRM job page.
- **Two crews tapping within seconds:** a YES confirms the newest pending alert regardless of job; the reply
  names the customer, which is the only tell. Add the job to the ack, or a per-job keyword, before crew #2.
- **Crew alert rows are never pruned** — a busy week leaves a long list on the job page. Fold older ones.
- **Worth-it panel passes every completed job id into one PostgREST `.in()`** — fine at 70 jobs, a long URL
  at hundreds. A view or rpc is the durable shape.
- **`/team/me` PushCard and `install-sheet.tsx` both detect standalone mode**; one shared hook.
- **`/portal` still points at `crm-manifest.json`** — confirm that's intended (its start_url is /crm).
- **Camera-sheet fallback leaves an empty viewfinder area** — a real phone never sees it; could collapse.
- **Hydration error #418 seen twice** in the browser pane during the 9/16 walk-through, never reproduced on
  any fresh load of /team, /team/jobs, /team/login, /crm/team/[id] or /crm/jobs/[id]. Likely a stale
  httpOnly `crew_session` on localhost during the redirect dance (see the builder rules). Watch prod.
- **Builder-rules note:** a stale httpOnly `crew_session` on localhost silently breaks crew-UI verification
  until you POST `/api/team/auth/logout` first.

## Crew tab bar — deferred at ship (2026-09-17)

- **`prettyDate` uses the client locale** (`toLocaleDateString(undefined, …)`) against the server's en-US — a
  latent hydration mismatch on a non-en-US phone. Pre-existing on every job card; the header now uses it too.
  Product call: hard-code en-US or keep localization.
- **Edge-to-edge iOS (`viewportFit: "cover"`)** was deliberately NOT enabled: the job screen's fixed action bar
  (`job-view.tsx`) has no `env(safe-area-inset-bottom)` padding, so cover would put the home indicator over
  On my way / Arrived / Done. Pad that bar first, then flip cover on the `/team` layout.
- A Today job with no `appointment_time` renders an empty right column on the highlighted card.
- Tabs rely on the browser default focus outline (no `focus-visible` ring).

## Crew pay — deferred at ship (2026-09-17)

- **Tips have no customer-side capture.** `crew_tip` is typed by Anthony on the CRM job. If tips ever get
  added to the invoice / Stripe checkout, the webhook should write `crew_tip` itself.
- **Hourly pay counts drive time** (`crewPayFor` on /team/me and the per-job derivation both use drive +
  on-site). If Anthony wants site-time only, change `jobBasePay`'s callers to pass work segments only —
  one rule in two places, keep them in step.
- **Tips split across a two-person crew** — one assignee per job today; when a job has two techs the
  tip needs a split rule.
- **Cancelling a job leaves the crew clock running** (PATCH status → cancelled). Same class as the
  completion fix; the pay call (is a cancelled drive paid to the cancel moment?) is Anthony's.
- **`closeJobClock` / `closeOpenSegment` swallow errors silently** — a failed close means pay keeps
  accruing with nothing in the logs. Add a `console.error`.
- **Finishing a scheduled job from the CRM cancels its Cal.com booking** (`leaveScheduled` runs for
  `complete` too, despite the comment saying it's exempt). Pre-existing, unrelated to pay.
