-- Applied to prod 2026-09-17 as `crew_tip`.
-- Tips are the customer's money handed to the crew, not what Anthony pays them.
-- Kept apart from crew_pay so the Worth-it math never counts a tip as a cost.
alter table public.squeegee_jobs add column if not exists crew_tip numeric(10,2);
comment on column public.squeegee_jobs.crew_tip is 'Tip the crew received on this job (customer money, not a cost). NULL = none recorded.';
comment on column public.squeegee_jobs.crew_pay is 'Base pay override for this job. NULL = derive from the employee''s pay_type/pay_rate and their clock on the job (hourly), or unknown (per_job/day_rate).';
