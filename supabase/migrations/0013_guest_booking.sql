-- 0013_guest_booking (brief 07): the guest's side of a booking request, and the host's request list.
--
--  * bookings.user_id: the account that sent a public request. Written only by create_public_booking,
--    from auth.uid() of the caller (never a parameter, never matched by email). Owners keep their
--    column grants on bookings except user_id, so no API role can set or move the link. No new policy
--    on bookings or guests: the guest reads his requests only through my_bookings().
--  * create_public_booking: same signature, same checks, same grants; it now stores the caller's
--    account (null for anon, or for a token whose account no longer exists).
--  * my_bookings(limit, offset): the caller's own requests, without contact data or ids of the host.
--  * pending_requests(limit, offset) / pending_requests_count(): live holds of the caller's
--    organizations, for the panel list "De confirmat" and the menu badge. No public_token.
--  * favorites: one row per (account, unit); own rows only; published units of active properties only.
--  * rate_limit_hit(bucket, ip, max, window): sliding-window counter for the server action (IP limit),
--    service_role only. The IP is stored as sha256(salt | bucket | ip); rows older than a day are pruned.
--
-- Every new function pins search_path = '' and gets an explicit grant (0002 revoked the PUBLIC
-- default). anon still executes exactly the four public functions of 0010. Errors carry the code as
-- the message, like 0010.

-- ---------------------------------------------------------------------------
-- bookings.user_id: link to the guest's account
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column user_id uuid references auth.users (id) on delete set null;
create index bookings_user_idx on public.bookings (user_id, created_at desc) where user_id is not null;

-- Owners write bookings through column grants that leave out user_id (and the generated stay).
revoke insert, update on public.bookings from authenticated;
grant insert (id, organization_id, unit_id, guest_id, ical_feed_id, external_uid, check_in, check_out,
              status, source, adults, children, total_amount, currency, hold_expires_at,
              stripe_checkout_session_id, public_token, created_at, updated_at)
  on public.bookings to authenticated;
grant update (id, organization_id, unit_id, guest_id, ical_feed_id, external_uid, check_in, check_out,
              status, source, adults, children, total_amount, currency, hold_expires_at,
              stripe_checkout_session_id, public_token, created_at, updated_at)
  on public.bookings to authenticated;

-- ---------------------------------------------------------------------------
-- create_public_booking: unchanged contract; links the hold to auth.uid() when there is one.
-- ---------------------------------------------------------------------------
create or replace function public.create_public_booking(
  p_unit_id uuid,
  p_check_in date,
  p_check_out date,
  p_full_name text,
  p_email text,
  p_phone text,
  p_adults integer default 1,
  p_children integer default 0
)
returns table (booking_id uuid, public_token uuid, total bigint, hold_expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  q record;
  v_name text := trim(p_full_name);
  v_email text := trim(p_email);
  v_phone text := trim(p_phone);
  v_expires timestamptz := now() + interval '24 hours';
  v_org uuid;
  v_guest uuid;
  v_booking uuid;
  v_token uuid;
  v_user uuid;
begin
  select * into q from public.public_quote(p_unit_id, p_check_in, p_check_out, p_adults, p_children);
  if not q.ok then
    raise exception '%', q.reason using errcode = case q.reason
      when 'unit_not_found' then 'P0002' when 'unavailable' then '23P01' else '22023' end;
  end if;

  if q.nights > 30 then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;
  if v_name is null or length(v_name) not between 1 and 80
     or v_email is null or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or v_phone is null or length(v_phone) > 32 or v_phone !~ '^\+?[0-9][0-9 ().-]{5,}$' then
    raise exception 'invalid_guest' using errcode = '22023';
  end if;

  -- The caller's account, only from the JWT. A token of a deleted account links nothing (no 23503).
  select u.id into v_user from auth.users u where u.id = (select auth.uid());

  -- Serialize per unit, then per email, so the counts below are exact (always in this order).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public_booking.unit'), pg_catalog.hashtext(p_unit_id::text));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public_booking.email'), pg_catalog.hashtext(lower(v_email)));

  -- An expired hold that was not swept yet must not block the dates (exclusion constraint).
  perform public.expire_holds(p_unit_id);

  if (select count(*) from public.bookings b
       where b.unit_id = p_unit_id and b.status = 'hold'
         and public.is_live_booking(b.status, b.hold_expires_at)) >= 20
     or (select count(*) from public.bookings b join public.guests g on g.id = b.guest_id
          where b.status = 'hold' and public.is_live_booking(b.status, b.hold_expires_at)
            and lower(g.email) = lower(v_email)) >= 3 then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  select u.organization_id into v_org from public.units u where u.id = p_unit_id;

  begin
    insert into public.guests (organization_id, full_name, email, phone)
    values (v_org, v_name, v_email, v_phone)
    returning id into v_guest;

    insert into public.bookings as b (organization_id, unit_id, guest_id, check_in, check_out, status, source,
                                      adults, children, total_amount, hold_expires_at, user_id)
    values (v_org, p_unit_id, v_guest, p_check_in, p_check_out, 'hold', 'direct',
            p_adults, p_children, q.total::integer, v_expires, v_user)
    returning b.id, b.public_token into v_booking, v_token;
  exception when exclusion_violation then
    -- the guest insert is rolled back with this block: no orphan guest
    raise exception 'unavailable' using errcode = '23P01';
  end;

  return query select v_booking, v_token, q.total, v_expires;
end
$$;

-- ---------------------------------------------------------------------------
-- my_bookings: the caller's own requests (bookings.user_id = auth.uid()), newest first.
-- A due hold not yet swept reads as expired. No contact data, no guest / organization ids,
-- no checkin_instructions. Errors: invalid_page (22023): limit 1-100, offset >= 0.
-- ---------------------------------------------------------------------------
create function public.my_bookings(p_limit integer default 20, p_offset integer default 0)
returns table (
  booking_id uuid,
  public_token uuid,
  status public.booking_status,
  check_in date,
  check_out date,
  unit_id uuid,
  unit_name text,
  property_name text,
  city text,
  adults integer,
  children integer,
  total_amount integer,
  currency text,
  hold_expires_at timestamptz,
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
  select b.id, b.public_token,
         case when b.status = 'hold' and not public.is_live_booking(b.status, b.hold_expires_at)
              then 'expired'::public.booking_status else b.status end,
         b.check_in, b.check_out, b.unit_id, u.name, p.name, p.city,
         b.adults, b.children, b.total_amount, b.currency, b.hold_expires_at, b.created_at,
         count(*) over ()
    from public.bookings b
    join public.units u on u.id = b.unit_id
    join public.properties p on p.id = u.property_id
   where b.user_id = v_user
   order by b.created_at desc, b.id desc
   limit p_limit offset p_offset;
end
$$;

-- ---------------------------------------------------------------------------
-- pending_requests / pending_requests_count: live holds of the caller's organizations.
-- Security invoker: owner RLS applies, plus an explicit is_org_member filter. A guest account (no
-- organization) gets nothing. The list and the count use the same predicate, so badge = list.
-- Most urgent first (hold_expires_at ascending). No public_token, no user_id.
-- Errors: invalid_page (22023): limit 1-100, offset >= 0.
-- ---------------------------------------------------------------------------
create function public.pending_requests(p_limit integer default 50, p_offset integer default 0)
returns table (
  booking_id uuid,
  unit_id uuid,
  property_id uuid,
  unit_name text,
  property_name text,
  check_in date,
  check_out date,
  adults integer,
  children integer,
  total_amount integer,
  currency text,
  hold_expires_at timestamptz,
  created_at timestamptz,
  guest_name text,
  guest_email text,
  guest_phone text,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset < 0 then
    raise exception 'invalid_page' using errcode = '22023';
  end if;

  return query
  select b.id, b.unit_id, u.property_id, u.name, p.name, b.check_in, b.check_out,
         b.adults, b.children, b.total_amount, b.currency, b.hold_expires_at, b.created_at,
         g.full_name, g.email, g.phone,
         count(*) over ()
    from public.bookings b
    join public.units u on u.id = b.unit_id
    join public.properties p on p.id = u.property_id
    left join public.guests g on g.id = b.guest_id
   where b.status = 'hold'
     and public.is_live_booking(b.status, b.hold_expires_at)
     and public.is_org_member(b.organization_id)
   order by b.hold_expires_at, b.created_at, b.id
   limit p_limit offset p_offset;
end
$$;

create function public.pending_requests_count()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
    from public.bookings b
   where b.status = 'hold'
     and public.is_live_booking(b.status, b.hold_expires_at)
     and public.is_org_member(b.organization_id)
$$;

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
-- "Published unit of an active property", for the favorites insert policy. Security definer because
-- an authenticated guest has no RLS read on units of other organizations (units_public is for anon).
-- Keep in step with properties_public / units_public, like public_busy_ranges and public_quote.
create function public.is_public_unit(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.units u join public.properties p on p.id = u.property_id
     where u.id = p_unit_id and u.is_published and p.status = 'activa'
  )
$$;

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint favorites_user_unit_key unique (user_id, unit_id)
);
create index favorites_unit_idx on public.favorites (unit_id);
create trigger set_updated_at before update on public.favorites
  for each row execute function public.set_updated_at();

alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;
grant select, delete on public.favorites to authenticated;
grant insert (user_id, unit_id) on public.favorites to authenticated;

-- No update policy and no update grant: a favourite is added or removed, never changed.
create policy favorites_select on public.favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy favorites_insert on public.favorites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_public_unit(unit_id));
create policy favorites_delete on public.favorites
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- IP rate limit (server action, service_role only)
-- ---------------------------------------------------------------------------
-- One random salt, generated on the database at migration time (never in the repo).
create table public.rate_limit_salt (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true,
  salt text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rate_limit_salt_singleton check (singleton),
  constraint rate_limit_salt_one_row unique (singleton)
);
create trigger set_updated_at before update on public.rate_limit_salt
  for each row execute function public.set_updated_at();
insert into public.rate_limit_salt default values;

-- One row per accepted hit. key_hash = sha256(salt | bucket | ip), hex.
create table public.rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  bucket text not null constraint rate_limit_hits_bucket_format check (bucket ~ '^[a-z][a-z0-9_]{0,39}$'),
  key_hash text not null constraint rate_limit_hits_key_hash_format check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rate_limit_hits_key_idx on public.rate_limit_hits (bucket, key_hash, created_at);
create index rate_limit_hits_created_idx on public.rate_limit_hits (created_at);
create trigger set_updated_at before update on public.rate_limit_hits
  for each row execute function public.set_updated_at();

-- RLS on, no policy: no API role reads or writes these rows; rate_limit_hit (security definer) does.
alter table public.rate_limit_salt enable row level security;
alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_salt, public.rate_limit_hits from anon, authenticated, service_role;

-- rate_limit_hit: at most p_max accepted hits per (bucket, ip) in the last p_window_seconds.
-- Allowed -> the hit is recorded; refused -> nothing is recorded, retry_after_seconds says when the
-- oldest hit in the window leaves it. Rows older than a day (the longest window) are pruned.
-- Errors: invalid_rate_limit (22023): bucket ^[a-z][a-z0-9_]{0,39}$, ip 1-100 chars after trim,
-- max 1-1000000, window 1-86400 seconds.
create function public.rate_limit_hit(
  p_bucket text,
  p_ip text,
  p_max integer default 5,
  p_window_seconds integer default 3600
)
returns table (allowed boolean, hits integer, retry_after_seconds integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_ip text := lower(trim(p_ip));
  v_window interval;
  v_key text;
  v_count integer;
  v_oldest timestamptz;
begin
  if p_bucket is null or p_bucket !~ '^[a-z][a-z0-9_]{0,39}$'
     or v_ip is null or length(v_ip) not between 1 and 100
     or p_max is null or p_max not between 1 and 1000000
     or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid_rate_limit' using errcode = '22023';
  end if;
  v_window := make_interval(secs => p_window_seconds);

  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(s.salt || '|' || p_bucket || '|' || v_ip, 'UTF8')), 'hex')
    into v_key
    from public.rate_limit_salt s;

  -- Two requests from the same IP count one after the other.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('rate_limit'), pg_catalog.hashtext(v_key));

  delete from public.rate_limit_hits h where h.created_at < now() - interval '1 day';

  select count(*)::integer, min(h.created_at) into v_count, v_oldest
    from public.rate_limit_hits h
   where h.bucket = p_bucket and h.key_hash = v_key and h.created_at > now() - v_window;

  if v_count >= p_max then
    return query select false, v_count,
      greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::integer);
    return;
  end if;

  insert into public.rate_limit_hits (bucket, key_hash) values (p_bucket, v_key);
  return query select true, v_count + 1, 0;
end
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.my_bookings(integer, integer) from public, anon;
revoke execute on function public.pending_requests(integer, integer) from public, anon;
revoke execute on function public.pending_requests_count() from public, anon;
revoke execute on function public.is_public_unit(uuid) from public, anon;
revoke execute on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;

grant execute on function public.my_bookings(integer, integer) to authenticated;
grant execute on function public.pending_requests(integer, integer) to authenticated;
grant execute on function public.pending_requests_count() to authenticated;
grant execute on function public.is_public_unit(uuid) to authenticated;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;
