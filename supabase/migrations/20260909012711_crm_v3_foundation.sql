-- CRM v3 foundation (2026-09-08). See SPEC-CRM-V3.md, "Schema changes".
-- Applied to the live project through the Supabase MCP with this exact body.
-- Every new table: RLS on, zero policies, anon/authenticated revoked
-- (service-role only, like every other squeegee table).

-- 1. Jobs. Lost work leaves the board; junk/test rows are EXCLUDED, never
--    deleted (a job delete cascades paid invoices and rewrites history).
alter table squeegee_jobs drop constraint if exists squeegee_jobs_status_check;
alter table squeegee_jobs add constraint squeegee_jobs_status_check
  check (status = any (array['new','quoted','approved','scheduled','complete','cancelled']));
alter table squeegee_jobs add column if not exists excluded_at timestamptz;
alter table squeegee_jobs add column if not exists lead_source text;
alter table squeegee_jobs drop constraint if exists squeegee_jobs_lead_source_check;
alter table squeegee_jobs add constraint squeegee_jobs_lead_source_check
  check (lead_source is null or lead_source = any (array[
    'door_knock','google','referral','nextdoor','yard_sign','social','website','repeat','other']));
create index if not exists squeegee_jobs_lead_source_idx on squeegee_jobs (lead_source) where lead_source is not null;

-- 2. Quotes. Duplicates get superseded (never "declined" - the customer
--    declined nothing), and accepted_via records how a quote was accepted so
--    the headline win rate counts only customer answers.
alter table squeegee_quotes drop constraint if exists squeegee_quotes_status_check;
alter table squeegee_quotes add constraint squeegee_quotes_status_check
  check (status = any (array['pending','accepted','declined','help','superseded']));
alter table squeegee_quotes add column if not exists accepted_via text;
alter table squeegee_quotes drop constraint if exists squeegee_quotes_accepted_via_check;
alter table squeegee_quotes add constraint squeegee_quotes_accepted_via_check
  check (accepted_via is null or accepted_via = any (array[
    'customer','sms_intake','auto_close','close_out','reconcile','manual']));
alter table squeegee_quotes add column if not exists closed_at timestamptz;
alter table squeegee_quotes add column if not exists close_note text;
alter table squeegee_quotes add column if not exists superseded_by uuid references squeegee_quotes(id) on delete set null;
alter table squeegee_quotes add column if not exists excluded_at timestamptz;
alter table squeegee_quotes add column if not exists last_digest_at timestamptz;
-- Every accepted quote to date carries client_response_at (41 of 41 on 9/8):
-- the customer tapped Accept on /q.
update squeegee_quotes
   set accepted_via = case when client_response_at is not null then 'customer' else 'sms_intake' end
 where status = 'accepted' and accepted_via is null;
-- The Slack digest cron had been stamping last_followup_at. From here on that
-- column means "the customer was actually texted"; the digest gets its own.
update squeegee_quotes set last_digest_at = last_followup_at, last_followup_at = null
 where last_followup_at is not null;

-- 3. Plans: same digest split.
alter table squeegee_plans add column if not exists last_digest_at timestamptz;
update squeegee_plans set last_digest_at = last_followup_at, last_followup_at = null
 where last_followup_at is not null;

-- 4. Invoices. Tender is a closed set (NULL = paid, tender unrecorded); numbers
--    come from a sequence instead of count(*)+1001, which repeats after a delete.
alter table squeegee_invoices drop constraint if exists squeegee_invoices_payment_method_check;
alter table squeegee_invoices add constraint squeegee_invoices_payment_method_check
  check (payment_method is null or payment_method = any (array['stripe','card','cash','zelle','check']));
create sequence if not exists squeegee_invoice_seq;
select setval('squeegee_invoice_seq',
  greatest(1000, coalesce((select max(substring(invoice_number from '(\d+)$')::int) from squeegee_invoices), 1000)));

-- 5. Clients. lead_source = how the relationship began (never 'repeat'); tags.
alter table squeegee_clients add column if not exists lead_source text;
alter table squeegee_clients drop constraint if exists squeegee_clients_lead_source_check;
alter table squeegee_clients add constraint squeegee_clients_lead_source_check
  check (lead_source is null or lead_source = any (array[
    'door_knock','google','referral','nextdoor','yard_sign','social','website','other']));
alter table squeegee_clients add column if not exists lead_source_at timestamptz;
alter table squeegee_clients add column if not exists lead_source_note text;
alter table squeegee_clients add column if not exists tags text[] not null default '{}';
alter table squeegee_clients drop constraint if exists squeegee_clients_tags_sane;
alter table squeegee_clients add constraint squeegee_clients_tags_sane
  check (coalesce(array_length(tags, 1), 0) <= 12);
create index if not exists squeegee_clients_tags_gin on squeegee_clients using gin (tags);

-- 6. Expenses. No 'labor' category on purpose: crew cost lives on
--    squeegee_jobs.crew_pay and is subtracted separately, so it can't be
--    counted twice.
create table if not exists squeegee_expenses (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  spent_on     date not null default (now() at time zone 'America/New_York')::date,
  amount       numeric not null check (amount > 0),
  category     text not null check (category = any (array[
                 'chemicals','fuel','vehicle','equipment','repairs','insurance',
                 'software','marketing','supplies','fees','permits','other'])),
  vendor       text,
  note         text,
  receipt_path text,
  job_id       uuid references squeegee_jobs(id) on delete set null,
  created_by   text not null default 'crm'
);
create index if not exists squeegee_expenses_spent_on_idx on squeegee_expenses (spent_on desc);
alter table squeegee_expenses enable row level security;
revoke all on squeegee_expenses from anon, authenticated;
grant all on squeegee_expenses to service_role;

-- 7. Settings: key/value jsonb (cadences, automation toggles, caps).
create table if not exists squeegee_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table squeegee_settings enable row level security;
revoke all on squeegee_settings from anon, authenticated;
grant all on squeegee_settings to service_role;
