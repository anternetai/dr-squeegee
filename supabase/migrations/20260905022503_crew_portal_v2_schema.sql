-- Reconstructed 2026-09-08 from the live schema; the original was applied directly on 2026-09-05.
--
-- Crew Portal v2: the /team surface a crew member runs a day from -- phone+PIN
-- login, the unclaimed-job pool, before/after photos, the drive/work clock, and
-- web push. Everything below already exists in production; this file is the
-- checked-in record of it, written from information_schema / pg_constraint /
-- pg_indexes so a rebuilt database matches what is actually running. It is
-- idempotent and safe to replay.

-- ---------------------------------------------------------------------------
-- squeegee_jobs: the three columns the field surface added.
-- ---------------------------------------------------------------------------
-- field_status is the crew's view of a job (claimed / on_my_way / in_progress /
-- complete) and is deliberately separate from squeegee_jobs.status, which is the
-- office lifecycle (new -> quoted -> approved -> scheduled -> complete). crew_pay
-- is what the crew member earns on this job -- never the customer price, which
-- must not reach the /team surface at all.
alter table squeegee_jobs add column if not exists field_status text;
alter table squeegee_jobs add column if not exists claimed_at timestamptz;
alter table squeegee_jobs add column if not exists crew_pay numeric;

-- ---------------------------------------------------------------------------
-- squeegee_employees: PIN login.
-- ---------------------------------------------------------------------------
-- pin_hash is a scrypt hash, never the PIN. pin_attempts accumulates across
-- lockouts on purpose, so the third lockout is longer than the first.
alter table squeegee_employees add column if not exists pin_hash text;
alter table squeegee_employees add column if not exists pin_attempts integer not null default 0;
alter table squeegee_employees add column if not exists pin_locked_until timestamptz;

-- ---------------------------------------------------------------------------
-- squeegee_job_time -- the drive/work clock.
-- ---------------------------------------------------------------------------
create table if not exists squeegee_job_time (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references squeegee_jobs(id) on delete cascade,
  employee_id uuid not null references squeegee_employees(id),
  kind text not null check (kind in ('drive', 'work')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists squeegee_job_time_job_idx on squeegee_job_time (job_id);
create index if not exists squeegee_job_time_employee_idx on squeegee_job_time (employee_id, started_at desc);

-- One open segment per person, enforced in the database rather than in the
-- route. A double-tapped "start" on a phone with a flaky signal is the normal
-- case, not the exotic one, and lib/squeegee/crew.ts openSegment() relies on
-- this index to be the thing that actually stops it.
create unique index if not exists squeegee_job_time_one_open_per_employee
  on squeegee_job_time (employee_id) where ended_at is null;

-- ---------------------------------------------------------------------------
-- squeegee_job_photos -- before/after proof.
-- ---------------------------------------------------------------------------
-- customer_visible defaults to false: a crew photo is internal until Anthony
-- approves it in the CRM. The paid-receipt page reads only rows where it is
-- true, and the photo proxy re-checks that on every request.
create table if not exists squeegee_job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references squeegee_jobs(id) on delete cascade,
  employee_id uuid references squeegee_employees(id),
  kind text not null check (kind in ('before', 'after')),
  storage_path text not null,
  customer_visible boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists squeegee_job_photos_job_idx on squeegee_job_photos (job_id, kind);

-- ---------------------------------------------------------------------------
-- squeegee_push_subscriptions -- web push to crew handsets.
-- ---------------------------------------------------------------------------
-- endpoint is unique because the browser re-issues the same endpoint for the
-- same device, so a re-subscribe is an upsert, not a second row. failure_count
-- and last_success_at are what /crm/team/[id] reads to say whether push is
-- actually reaching a phone instead of silently rotting.
create table if not exists squeegee_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references squeegee_employees(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0
);

create index if not exists squeegee_push_subs_employee_idx on squeegee_push_subscriptions (employee_id);

-- ---------------------------------------------------------------------------
-- RLS: service-role only, matching every other squeegee_* table.
-- ---------------------------------------------------------------------------
-- RLS on with zero policies means the anon and authenticated keys can read
-- nothing here -- and the anon key is public. The /team surface has no Supabase
-- identity: it is gated by the crew_session cookie and every route reads and
-- writes with the service-role client. Do not add a policy to "make a page
-- work"; use the service-role client in that page instead.
alter table squeegee_job_time enable row level security;
alter table squeegee_job_photos enable row level security;
alter table squeegee_push_subscriptions enable row level security;

-- ---------------------------------------------------------------------------
-- job-photos storage bucket -- private, created live on 2026-09-05.
-- ---------------------------------------------------------------------------
-- Private with zero storage.objects policies, for the same reason as above.
-- Crew uploads and the customer-facing receipt both go through server routes
-- that use the service-role client; nothing reads this bucket directly.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  false,
  10485760,
  array['image/jpeg', 'image/webp', 'image/png']
)
on conflict (id) do nothing;
