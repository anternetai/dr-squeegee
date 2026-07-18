-- Embedded quote pay + tip: bank tips separately, link invoices directly to quotes.
-- Apply to Supabase project umugyukdedithkbtnhtd.

alter table public.squeegee_invoices add column if not exists tip_amount numeric not null default 0;
alter table public.squeegee_invoices add column if not exists quote_id uuid references public.squeegee_quotes(id);
create index if not exists idx_squeegee_invoices_quote_id on public.squeegee_invoices(quote_id);
alter table public.squeegee_invoices add constraint squeegee_invoices_tip_nonneg check (tip_amount >= 0);

-- Backfill quote_id on existing invoices via job_id (all unpaid invoices have a job_id).
update public.squeegee_invoices i
set quote_id = q.id
from public.squeegee_quotes q
where i.quote_id is null and i.job_id is not null
  and q.job_id = i.job_id and q.status = 'accepted';

-- Verify (expect 0):
--   select count(*) from public.squeegee_invoices where quote_id is null and status <> 'paid';
