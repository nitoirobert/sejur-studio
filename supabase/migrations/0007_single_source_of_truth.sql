-- 0007_single_source_of_truth: facts that were stored twice, with nothing keeping the copies equal.
--
--  * payments.status ('refunded', 'partially_refunded') and payments.refunded_amount said the same
--    thing. The refund state is now a constraint, so the pair cannot disagree; it replaces
--    payments_refund_check (refunded_amount <= amount), which it implies.
--  * bookings.stripe_payment_intent_id copied payments.stripe_payment_intent_id. A payment belongs to
--    payments (a booking can have several); the booking keeps only stripe_checkout_session_id, which
--    is how the webhook finds the hold.
--  * sync_conflicts.resolved and resolved_at: "resolved" is resolved_at is not null.

-- Refund state: full refund = whole amount, partial = something but not all, otherwise nothing refunded.
alter table public.payments drop constraint payments_refund_check;
alter table public.payments add constraint payments_refund_state_check check (
  case status
    when 'refunded' then refunded_amount = amount
    when 'partially_refunded' then refunded_amount > 0 and refunded_amount < amount
    else refunded_amount = 0
  end
);

alter table public.bookings drop column stripe_payment_intent_id;

-- Dropping the column drops sync_conflicts_org_idx (organization_id, resolved); recreate it on resolved_at.
update public.sync_conflicts set resolved_at = coalesce(resolved_at, updated_at) where resolved and resolved_at is null;
alter table public.sync_conflicts drop column resolved;
create index sync_conflicts_org_idx on public.sync_conflicts (organization_id, resolved_at);
