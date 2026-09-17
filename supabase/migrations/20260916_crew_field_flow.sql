-- Crew field flow v3 (2026-09-16): Arrived step, owner-confirmed customer texts,
-- per-service photo gate, per-employee contact switch. See SPEC-CREW-FIELD-FLOW.md.

-- Whether this crew member may call/text the customer from the job screen.
-- Default true so existing behavior is unchanged until Anthony flips it.
alter table squeegee_employees
  add column if not exists can_contact_customers boolean not null default true;

-- Which service a before/after photo belongs to. NULL = taken before this rule
-- existed and counts as a wildcard for the gate (see lib/squeegee/field.ts).
alter table squeegee_job_photos
  add column if not exists service text;

-- A crew status tap (on the way / arrived) that texted Anthony and is waiting
-- on his YES before the customer hears anything.
create table if not exists squeegee_crew_alerts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references squeegee_jobs(id) on delete cascade,
  employee_id uuid references squeegee_employees(id) on delete set null,
  kind text not null check (kind in ('on_my_way', 'arrived')),
  eta_minutes integer,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'expired')),
  owner_sms_id uuid,
  customer_sms_id uuid,
  created_at timestamptz not null default now(),
  acted_at timestamptz
);

create index if not exists squeegee_crew_alerts_status_idx
  on squeegee_crew_alerts (status, created_at desc);
create index if not exists squeegee_crew_alerts_job_idx
  on squeegee_crew_alerts (job_id, created_at desc);

-- Service-role only, like every other crew table: RLS on, zero policies.
alter table squeegee_crew_alerts enable row level security;
revoke all on squeegee_crew_alerts from anon, authenticated;
