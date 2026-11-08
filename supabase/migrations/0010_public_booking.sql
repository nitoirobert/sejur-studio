-- 0010_public_booking: the booking contract with Robert's public site (brief 05), plus the owner
-- functions brief 04 needs.
--
--  * public_quote(unit, check_in, check_out, adults, children): the one price rule. Per night: the
--    season with the highest priority that covers the night, else the weekend rule (Friday and
--    Saturday nights), else the base price. Ties (same kind, same priority) go to the newest
--    created_at, then the highest id, so the result is deterministic. Refusals come back as
--    ok = false + reason, in a fixed order (docs/DB.md, "Rezervare publică").
--  * create_public_booking(...): re-prices through public_quote (the client never sends an amount),
--    then guest + hold (source direct, 24 h) in one transaction. Anti-abuse limits live here: at most
--    3 live holds per email (trim + lower), 20 per unit, 30 nights per hold. The IP limit and
--    Turnstile are Robert's server action (the database only sees Vercel's IP).
--  * public_booking_status(token): status, dates, names and total only. A token that is not a
--    canonical uuid gets the same empty answer as an unknown one (no 22P02).
--  * confirm_booking / decline_booking: owner only, live hold -> confirmed / hold -> cancelled.
--  * create_manual_booking: the same length / count limits as the public path, max 366 nights.
--  * reorder_units, save_unit (brief 04): unit order like reorder_photos; unit + base price in one
--    transaction. A published unit must have a base price > 0: deferred constraint triggers on units
--    and unit_prices, so direct table writes obey it too.
--  * Storage: an owner may write only <own org>/<own property of that org>/<name>.webp.
--  * pg_cron job `expire-holds` every 5 minutes (cron.schedule upserts by name: re-running the
--    migration does not add a second job).
--
-- The three public functions and confirm/decline are security definer (they read and write rows the
-- caller's RLS hides, or must not depend on it); everything else is security invoker. All pin
-- search_path = '' and get an explicit grant (0002 revoked the PUBLIC default). Errors are raised with
-- the code as the message; no raw Postgres text reaches the client.
-- public_quote and create_public_booking repeat "published unit of an active property", like
-- public_busy_ranges (0008): keep the three in step with properties_public / units_public.

-- ---------------------------------------------------------------------------
-- public_quote
-- Reason order: unit_not_found, invalid_dates, invalid_guest, too_many_guests, no_price,
-- min_nights, invalid_amount, unavailable. On ok = false, nights / total / nightly are null.
-- ---------------------------------------------------------------------------
create function public.public_quote(
  p_unit_id uuid,
  p_check_in date,
  p_check_out date,
  p_adults integer default 1,
  p_children integer default 0
)
returns table (nights integer, total bigint, currency text, nightly jsonb, ok boolean, reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_max_guests integer;
  v_nights integer;
  v_total bigint;
  v_nightly jsonb;
  v_min_nights integer;
  v_unpriced boolean;
  v_reason text;
begin
  <<checks>>
  begin
    -- Same answer for a missing unit, an unpublished one and one of a hidden property.
    select u.max_guests into v_max_guests
      from public.units u
      join public.properties p on p.id = u.property_id
     where u.id = p_unit_id and u.is_published and p.status = 'activa';
    if not found then
      v_reason := 'unit_not_found'; exit checks;
    end if;

    -- isfinite first, in its own test: subtracting 'infinity' dates raises 22008.
    if p_check_in is null or p_check_out is null
       or not pg_catalog.isfinite(p_check_in) or not pg_catalog.isfinite(p_check_out) then
      v_reason := 'invalid_dates'; exit checks;
    end if;
    if p_check_out <= p_check_in or p_check_in < public.bucharest_today()
       or p_check_in > public.bucharest_today() + 730 or p_check_out - p_check_in > 366 then
      v_reason := 'invalid_dates'; exit checks;
    end if;
    v_nights := p_check_out - p_check_in;

    if p_adults is null or p_adults not between 1 and 20
       or p_children is null or p_children not between 0 and 20 then
      v_reason := 'invalid_guest'; exit checks;
    end if;
    if p_adults + p_children > v_max_guests then
      v_reason := 'too_many_guests'; exit checks;
    end if;

    -- One rule per night: season > weekend > base; within a kind, priority, then newest.
    -- date_from / date_to are read on season rules only.
    select sum(r.price_per_night),
           jsonb_object_agg(pg_catalog.to_char((p_check_in + n.i)::timestamp, 'YYYY-MM-DD'), r.price_per_night),
           max(r.min_nights),
           bool_or(r.price_per_night is null or r.price_per_night = 0)
      into v_total, v_nightly, v_min_nights, v_unpriced
      from generate_series(0, v_nights - 1) as n(i)
      left join lateral (
        select up.price_per_night, up.min_nights
          from public.unit_prices up
         where up.unit_id = p_unit_id
           and (up.kind = 'base'
                or (up.kind = 'weekend' and extract(isodow from p_check_in + n.i) in (5, 6))
                or (up.kind = 'season' and p_check_in + n.i >= up.date_from and p_check_in + n.i < up.date_to))
         order by case up.kind when 'season' then 0 when 'weekend' then 1 else 2 end,
                  up.priority desc, up.created_at desc, up.id desc
         limit 1
      ) r on true;

    if v_unpriced or not exists (
      select 1 from public.unit_prices up
       where up.unit_id = p_unit_id and up.kind = 'base' and up.price_per_night > 0
    ) then
      v_reason := 'no_price'; exit checks;
    end if;
    if v_nights < v_min_nights then
      v_reason := 'min_nights'; exit checks;
    end if;
    -- bookings.total_amount is integer: a larger total is refused with a code, never 22003.
    if v_total > 2147483647 then
      v_reason := 'invalid_amount'; exit checks;
    end if;

    if exists (
      select 1 from public.bookings b
       where b.unit_id = p_unit_id
         and b.stay && daterange(p_check_in, p_check_out, '[)')
         and public.is_live_booking(b.status, b.hold_expires_at)
    ) then
      v_reason := 'unavailable'; exit checks;
    end if;
  end checks;

  if v_reason is not null then
    return query select null::integer, null::bigint, 'RON'::text, null::jsonb, false, v_reason;
  else
    return query select v_nights, v_total, 'RON'::text, v_nightly, true, null::text;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- create_public_booking: guest + hold. Errors (message = code): the public_quote reasons in their
-- order, then invalid_dates (over 30 nights), invalid_guest (name / email / phone), too_many_requests;
-- unavailable also when a concurrent hold wins the exclusion constraint.
-- ---------------------------------------------------------------------------
create function public.create_public_booking(
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
                                      adults, children, total_amount, hold_expires_at)
    values (v_org, p_unit_id, v_guest, p_check_in, p_check_out, 'hold', 'direct',
            p_adults, p_children, q.total::integer, v_expires)
    returning b.id, b.public_token into v_booking, v_token;
  exception when exclusion_violation then
    -- the guest insert is rolled back with this block: no orphan guest
    raise exception 'unavailable' using errcode = '23P01';
  end;

  return query select v_booking, v_token, q.total, v_expires;
end
$$;

-- ---------------------------------------------------------------------------
-- public_booking_status: no contact data, no ids. A due hold not yet swept reads as expired.
-- ---------------------------------------------------------------------------
create function public.public_booking_status(p_token text)
returns table (
  status public.booking_status,
  check_in date,
  check_out date,
  property_name text,
  unit_name text,
  total_amount integer,
  currency text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Only a canonical uuid is looked up; anything else is "not found", never a cast error.
  if p_token is null
     or p_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return;
  end if;

  return query
  select case when b.status = 'hold' and not public.is_live_booking(b.status, b.hold_expires_at)
              then 'expired'::public.booking_status else b.status end,
         b.check_in, b.check_out, p.name, u.name, b.total_amount, b.currency
    from public.bookings b
    join public.units u on u.id = b.unit_id
    join public.properties p on p.id = u.property_id
   where b.public_token = p_token::uuid;
end
$$;

-- ---------------------------------------------------------------------------
-- confirm_booking / decline_booking: owner of the booking's organization only.
-- Errors: booking_not_found (P0002), hold_expired / invalid_status (22023).
-- ---------------------------------------------------------------------------
create function public.confirm_booking(p_booking_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.booking_status;
  v_expires timestamptz;
begin
  select b.status, b.hold_expires_at into v_status, v_expires
    from public.bookings b
   where b.id = p_booking_id and public.is_org_member(b.organization_id)
   for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if v_status = 'hold' and public.is_live_booking(v_status, v_expires) then
    update public.bookings b set status = 'confirmed', hold_expires_at = null where b.id = p_booking_id;
  elsif v_status in ('hold', 'expired') then
    raise exception 'hold_expired' using errcode = '22023';
  else
    raise exception 'invalid_status' using errcode = '22023';
  end if;
end
$$;

create function public.decline_booking(p_booking_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.booking_status;
begin
  select b.status into v_status
    from public.bookings b
   where b.id = p_booking_id and public.is_org_member(b.organization_id)
   for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if v_status = 'hold' then
    update public.bookings b set status = 'cancelled' where b.id = p_booking_id;
  else
    raise exception 'invalid_status' using errcode = '22023';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- create_manual_booking: the public limits (name 1-80, email <= 254, phone <= 32, adults 1-20,
-- children 0-20) and at most 366 nights. Signature, errors and grants unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.create_manual_booking(
  p_unit_id uuid,
  p_check_in date,
  p_check_out date,
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_adults integer default 1,
  p_children integer default 0,
  p_total_amount integer default 0
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_guest uuid;
  v_booking uuid;
begin
  select u.organization_id into v_org from public.units u where u.id = p_unit_id;
  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'unit_not_found' using errcode = 'P0002';
  end if;

  if p_check_in is null or p_check_out is null
     or not pg_catalog.isfinite(p_check_in) or not pg_catalog.isfinite(p_check_out) then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;
  if p_check_out <= p_check_in or p_check_out - p_check_in > 366 then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;
  if p_full_name is null or length(trim(p_full_name)) not between 1 and 80
     or length(trim(p_email)) > 254 or length(trim(p_phone)) > 32
     or coalesce(p_adults, 0) not between 1 and 20 or coalesce(p_children, 0) not between 0 and 20 then
    raise exception 'invalid_guest' using errcode = '22023';
  end if;
  if p_total_amount is null or p_total_amount < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  perform public.expire_holds(p_unit_id);

  begin
    insert into public.guests (organization_id, full_name, email, phone)
    values (v_org, trim(p_full_name), nullif(trim(p_email), ''), nullif(trim(p_phone), ''))
    returning id into v_guest;

    insert into public.bookings (organization_id, unit_id, guest_id, check_in, check_out,
                                 status, source, adults, children, total_amount)
    values (v_org, p_unit_id, v_guest, p_check_in, p_check_out,
            'confirmed', 'direct', p_adults, coalesce(p_children, 0), p_total_amount)
    returning id into v_booking;
  exception when exclusion_violation then
    -- the guest insert is rolled back with this block: no orphan guest
    raise exception 'booking_overlap' using errcode = '23P01',
      detail = 'The unit already has a booking in this interval.';
  end;

  return v_booking;
end
$$;

-- ---------------------------------------------------------------------------
-- A published unit has a base price > 0. Deferred to commit, so a unit and its price can be written
-- in either order inside one transaction. Errors: no_price (23514).
-- ---------------------------------------------------------------------------
create function public.check_unit_base_price()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_unit uuid;
begin
  -- Separate statements: each is planned only for its own table's row type.
  if tg_table_name = 'units' then
    v_unit := new.id;
  else
    v_unit := old.unit_id;
  end if;
  if exists (select 1 from public.units u where u.id = v_unit and u.is_published)
     and not exists (select 1 from public.unit_prices up
                      where up.unit_id = v_unit and up.kind = 'base' and up.price_per_night > 0) then
    raise exception 'no_price' using errcode = '23514';
  end if;
  return null;
end
$$;

create constraint trigger units_published_needs_price
  after insert or update of is_published on public.units
  deferrable initially deferred
  for each row when (new.is_published)
  execute function public.check_unit_base_price();

create constraint trigger unit_prices_published_needs_price
  after update or delete on public.unit_prices
  deferrable initially deferred
  for each row when (old.kind = 'base')
  execute function public.check_unit_base_price();

-- ---------------------------------------------------------------------------
-- reorder_units: p_unit_ids must be exactly all units of the property, in the new order;
-- positions become 0..n-1. Errors: property_not_found (P0002), unit_set_mismatch (22023).
-- ---------------------------------------------------------------------------
create function public.reorder_units(p_property_id uuid, p_unit_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_n integer := coalesce(cardinality(p_unit_ids), 0);
begin
  select p.organization_id into v_org from public.properties p where p.id = p_property_id;
  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'property_not_found' using errcode = 'P0002';
  end if;

  if v_n <> (select count(distinct x) from unnest(p_unit_ids) x)
     or v_n <> (select count(*) from public.units u where u.property_id = p_property_id)
     or v_n <> (select count(*) from public.units u
                where u.property_id = p_property_id and u.id = any (p_unit_ids)) then
    raise exception 'unit_set_mismatch' using errcode = '22023';
  end if;

  update public.units u
     set position = o.ord - 1
    from unnest(p_unit_ids) with ordinality as o(unit_id, ord)
   where u.id = o.unit_id and u.property_id = p_property_id and u.position <> o.ord - 1;
end
$$;

-- ---------------------------------------------------------------------------
-- save_unit: create (p_unit_id null, appended last) or edit a unit together with its base price.
-- The price is written before the unit is published, so the rule above holds even with the
-- constraints set immediate. Returns the unit id.
-- Errors: property_not_found / unit_not_found (P0002), invalid_unit / invalid_price (22023).
-- ---------------------------------------------------------------------------
create function public.save_unit(
  p_property_id uuid,
  p_name text,
  p_type text,
  p_max_guests integer,
  p_bedrooms integer,
  p_beds integer,
  p_bathrooms integer,
  p_area_m2 integer,
  p_description text,
  p_amenities jsonb,
  p_is_published boolean,
  p_base_price integer,
  p_unit_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_unit uuid := p_unit_id;
  v_name text := trim(p_name);
  v_description text := nullif(trim(p_description), '');
  v_amenities jsonb := coalesce(p_amenities, '[]'::jsonb);
begin
  select p.organization_id into v_org from public.properties p where p.id = p_property_id;
  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'property_not_found' using errcode = 'P0002';
  end if;

  if v_name is null or length(v_name) not between 1 and 80
     or p_type is null or not (p_type = any (enum_range(null::public.unit_type)::text[]))
     or p_max_guests is null or p_max_guests not between 1 and 50
     or p_bedrooms is null or p_bedrooms not between 0 and 50
     or p_beds is null or p_beds not between 0 and 100
     or p_bathrooms is null or p_bathrooms not between 0 and 50
     or (p_area_m2 is not null and p_area_m2 not between 1 and 10000)
     or length(v_description) > 4000
     or jsonb_typeof(v_amenities) <> 'array' or jsonb_array_length(v_amenities) > 50
     or exists (select 1 from jsonb_array_elements(v_amenities) e where jsonb_typeof(e) <> 'string')
     or p_is_published is null then
    raise exception 'invalid_unit' using errcode = '22023';
  end if;
  if p_base_price is null or p_base_price not between 1 and 2100000000 then
    raise exception 'invalid_price' using errcode = '22023';
  end if;

  if v_unit is null then
    insert into public.units (organization_id, property_id, name, type, max_guests, bedrooms, beds, bathrooms,
                              area_m2, description, amenities, position, is_published)
    values (v_org, p_property_id, v_name, p_type::public.unit_type, p_max_guests, p_bedrooms, p_beds, p_bathrooms,
            p_area_m2, v_description, v_amenities,
            coalesce((select max(u.position) + 1 from public.units u where u.property_id = p_property_id), 0),
            false)
    returning id into v_unit;
  elsif not exists (select 1 from public.units u where u.id = v_unit and u.property_id = p_property_id) then
    raise exception 'unit_not_found' using errcode = 'P0002';
  end if;

  insert into public.unit_prices as up (organization_id, unit_id, kind, price_per_night)
  values (v_org, v_unit, 'base', p_base_price)
  on conflict (unit_id) where kind = 'base'
  do update set price_per_night = excluded.price_per_night;

  update public.units u
     set name = v_name, type = p_type::public.unit_type, max_guests = p_max_guests, bedrooms = p_bedrooms,
         beds = p_beds, bathrooms = p_bathrooms, area_m2 = p_area_m2, description = v_description,
         amenities = v_amenities, is_published = p_is_published
   where u.id = v_unit;

  return v_unit;
end
$$;

-- ---------------------------------------------------------------------------
-- Storage: owners write only <own org>/<own property of that org>/<name>.webp. Read and delete stay
-- organization-wide (USING), so existing files can always be removed.
-- ---------------------------------------------------------------------------
drop policy photos_owner on storage.objects;
create policy photos_owner on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and public.is_own_storage_path(objects.name))
  with check (
    bucket_id = 'photos'
    and public.is_own_storage_path(objects.name)
    and objects.name ~ '^[^/]+/[^/]+/[a-z0-9-]{1,64}\.webp$'
    and exists (select 1 from public.properties p
                 where p.organization_id::text = split_part(objects.name, '/', 1)
                   and p.id::text = split_part(objects.name, '/', 2))
  );

-- ---------------------------------------------------------------------------
-- pg_cron: sweep expired holds every 5 minutes. Runs as the migration role, so expire_holds()
-- sees every organization. cron.schedule with a name replaces an existing job of that name.
-- cron.* functions carry a PUBLIC execute grant from supabase_admin that postgres cannot revoke;
-- anon and authenticated have no USAGE on schema cron, so they still cannot call them.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
select cron.schedule('expire-holds', '*/5 * * * *', 'select public.expire_holds()');

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.public_quote(uuid, date, date, integer, integer) from public;
revoke execute on function public.create_public_booking(uuid, date, date, text, text, text, integer, integer) from public;
revoke execute on function public.public_booking_status(text) from public;
revoke execute on function public.confirm_booking(uuid) from public, anon;
revoke execute on function public.decline_booking(uuid) from public, anon;
revoke execute on function public.reorder_units(uuid, uuid[]) from public, anon;
revoke execute on function public.save_unit(uuid, text, text, integer, integer, integer, integer, integer, text, jsonb, boolean, integer, uuid)
  from public, anon;
revoke execute on function public.check_unit_base_price() from public, anon, authenticated;

grant execute on function public.public_quote(uuid, date, date, integer, integer) to anon, authenticated;
grant execute on function public.create_public_booking(uuid, date, date, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.public_booking_status(text) to anon, authenticated;
grant execute on function public.confirm_booking(uuid) to authenticated;
grant execute on function public.decline_booking(uuid) to authenticated;
grant execute on function public.reorder_units(uuid, uuid[]) to authenticated;
grant execute on function public.save_unit(uuid, text, text, integer, integer, integer, integer, integer, text, jsonb, boolean, integer, uuid)
  to authenticated;
