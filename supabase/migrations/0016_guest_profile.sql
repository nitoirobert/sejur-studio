-- 0016_guest_profile: what the guest account page (/cont) needs beyond 0013.
--  * reviews: one review per booking, written by the account that made the request (bookings.user_id),
--    only for a confirmed stay that has ended. The author reads, edits and deletes his own rows.
--    Public display on unit pages comes later (needs moderation): no anon policy yet.
--  * my_payments(): the caller's payments (via bookings.user_id), without Stripe ids.
--  * delete_my_account(): the caller deletes his own auth user. Refused for host accounts
--    (organization members): their data belongs to the organization, they go through support.
--    bookings.user_id is set null (0013), favorites and reviews cascade.
-- Works for every account, guest or host: a host booking a stay elsewhere is a guest too.
-- Profile data (full_name, phone, notification preferences, custom_avatar_url) lives in
-- auth user_metadata and needs no table.

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_booking_key unique (booking_id)
);
create index reviews_user_idx on public.reviews (user_id, created_at desc);
create index reviews_unit_idx on public.reviews (unit_id, created_at desc);

alter table public.reviews enable row level security;

revoke all on public.reviews from anon, authenticated;
grant select, delete on public.reviews to authenticated;
grant insert (booking_id, unit_id, rating, comment) on public.reviews to authenticated;
grant update (rating, comment) on public.reviews to authenticated;

-- True when the booking belongs to the caller, matches the unit, is confirmed and has ended.
create function public.can_review_booking(p_booking_id uuid, p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and b.unit_id = p_unit_id
      and b.user_id = (select auth.uid())
      and b.status = 'confirmed'
      and b.check_out <= (now() at time zone 'Europe/Bucharest')::date
  )
$$;
revoke execute on function public.can_review_booking(uuid, uuid) from public, anon;
grant execute on function public.can_review_booking(uuid, uuid) to authenticated;

create policy reviews_own_select on public.reviews
  for select to authenticated using (user_id = (select auth.uid()));
create policy reviews_own_insert on public.reviews
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_review_booking(booking_id, unit_id));
create policy reviews_own_update on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy reviews_own_delete on public.reviews
  for delete to authenticated using (user_id = (select auth.uid()));

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- my_payments: the caller's payments, newest first. No Stripe ids, no organization id.
-- Errors: invalid_page (22023): limit 1-100, offset >= 0.
-- ---------------------------------------------------------------------------
create function public.my_payments(p_limit integer default 20, p_offset integer default 0)
returns table (
  payment_id uuid,
  booking_public_token uuid,
  unit_name text,
  property_name text,
  check_in date,
  check_out date,
  amount integer,
  refunded_amount integer,
  currency text,
  status public.payment_status,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then
    raise exception 'invalid_page' using errcode = '22023';
  end if;
  if v_user is null then
    return;
  end if;

  return query
  select pay.id, b.public_token, u.name, p.name, b.check_in, b.check_out,
         pay.amount, pay.refunded_amount, pay.currency, pay.status, pay.created_at,
         count(*) over ()
    from public.payments pay
    join public.bookings b on b.id = pay.booking_id
    join public.units u on u.id = b.unit_id
    join public.properties p on p.id = u.property_id
   where b.user_id = v_user
   order by pay.created_at desc, pay.id desc
   limit p_limit offset p_offset;
end
$$;
revoke execute on function public.my_payments(integer, integer) from public, anon;
grant execute on function public.my_payments(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- delete_my_account: deletes the caller's auth user.
-- Errors: not_authenticated (28000), host_account (42501) when the caller is an organization member.
-- The avatar file is removed by the client through the Storage API first (direct deletes from
-- storage.objects are blocked by Supabase).
-- ---------------------------------------------------------------------------
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.organization_members m where m.user_id = v_user) then
    raise exception 'host_account' using errcode = '42501';
  end if;
  delete from auth.users where id = v_user;
end
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
