-- Private feedback from the /review page.
--
-- The review page shows every customer the same two doors: leave a Google
-- review, or tell us directly. Nobody is routed by sentiment — Google prohibits
-- review gating and the FTC's Consumer Reviews rule covers review suppression —
-- so this table is the second door, not a filter in front of the first.

create table if not exists squeegee_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text,
  phone text,
  email text,
  message text not null,
  client_id uuid references squeegee_clients(id) on delete set null,
  job_id uuid references squeegee_jobs(id) on delete set null,
  source text not null default 'review_page',
  resolved_at timestamptz,
  resolution_note text
);

create index if not exists squeegee_feedback_created_idx on squeegee_feedback (created_at desc);
create index if not exists squeegee_feedback_unresolved_idx on squeegee_feedback (resolved_at) where resolved_at is null;

-- Service-role only: this is customer data and the anon key is public. The
-- public form posts to a rate-limited API route that writes with the
-- service-role client, so no anon grant is needed here.
alter table squeegee_feedback enable row level security;
