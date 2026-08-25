-- Receipts for paid invoices + the phantom column the send route was writing to.
--
-- A receipt is not its own record: it IS a paid invoice, viewed as a receipt.
-- So this adds a stable public token to the invoice rather than a receipts table
-- (one paid invoice can only ever produce one receipt, and re-sending must land
-- on the same URL the customer already has).
--
-- card_brand / card_last4 are captured from the Stripe charge at webhook time.
-- A receipt that can't name the card it was paid with isn't a real receipt, and
-- Stripe is the only place that knows.

-- 1) sent_at: app/api/squeegee/invoices/[id]/send/route.ts has always written
--    this column, but it was never created — every call to that route failed on
--    "column squeegee_invoices.sent_at does not exist" and returned 500.
alter table squeegee_invoices add column if not exists sent_at timestamptz;

-- 2) Receipt fields.
alter table squeegee_invoices add column if not exists receipt_token text;
alter table squeegee_invoices add column if not exists receipt_sent_at timestamptz;
alter table squeegee_invoices add column if not exists card_brand text;
alter table squeegee_invoices add column if not exists card_last4 text;

-- 3) Backfill a token for every invoice that is already paid, so historical
--    receipts are sendable the moment this ships (Curtis included).
update squeegee_invoices
set receipt_token = encode(gen_random_bytes(5), 'hex')
where receipt_token is null
  and status = 'paid';

-- 4) Uniqueness is what makes the token safe to treat as an access credential.
--    Partial index: unpaid invoices legitimately have no token.
create unique index if not exists squeegee_invoices_receipt_token_key
  on squeegee_invoices (receipt_token)
  where receipt_token is not null;

-- 5) The receipt page looks up by token on every view.
create index if not exists squeegee_invoices_receipt_token_lookup
  on squeegee_invoices (receipt_token);
