-- 0004_functions: owner RPCs (security invoker, so RLS applies on top of the explicit
-- membership checks) and the one anon RPC, public_busy_ranges (security definer).
-- All functions pin search_path = '' and use schema-qualified names.

-- Today in Europe/Bucharest (KPI "day" default). Exposed so tests can check the 23:30 UTC edge.
create function public.bucharest_today(p_now timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select (p_now at time zone 'Europe/Bucharest')::date
$$;

-- ---------------------------------------------------------------------------
-- create_manual_booking: guest + confirmed direct booking in one transaction.
-- Errors (message = code): unit_not_found (P0002), invalid_dates / invalid_guest /
-- invalid_amount (22023), booking_overlap (23P01).
-- ---------------------------------------------------------------------------
create function public.create_manual_booking(
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

  if p_check_in is null or p_check_out is null or p_check_out <= p_check_in then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;
  if p_full_name is null or length(trim(p_full_name)) = 0
     or coalesce(p_adults, 0) < 1 or coalesce(p_children, 0) < 0 then
    raise exception 'invalid_guest' using errcode = '22023';
  end if;
  if p_total_amount is null or p_total_amount < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- Release expired holds of this unit first, so they do not block the new booking.
  update public.bookings b
     set status = 'expired'
   where b.unit_id = p_unit_id and b.status = 'hold' and b.hold_expires_at < now();

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
-- reorder_photos: p_photo_ids must be exactly all photos of the property, in the new
-- order; positions become 0..n-1. Optional p_cover_id sets the single cover.
-- Errors: property_not_found (P0002), photo_set_mismatch (22023).
-- ---------------------------------------------------------------------------
create function public.reorder_photos(
  p_property_id uuid,
  p_photo_ids uuid[],
  p_cover_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_n integer := coalesce(cardinality(p_photo_ids), 0);
begin
  select p.organization_id into v_org from public.properties p where p.id = p_property_id;
  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'property_not_found' using errcode = 'P0002';
  end if;

  if v_n <> (select count(distinct x) from unnest(p_photo_ids) x)
     or v_n <> (select count(*) from public.photos ph where ph.property_id = p_property_id)
     or v_n <> (select count(*) from public.photos ph
                where ph.property_id = p_property_id and ph.id = any (p_photo_ids))
     or (p_cover_id is not null and not (p_cover_id = any (p_photo_ids))) then
    raise exception 'photo_set_mismatch' using errcode = '22023';
  end if;

  update public.photos ph
     set position = o.ord - 1
    from unnest(p_photo_ids) with ordinality as o(photo_id, ord)
   where ph.id = o.photo_id and ph.property_id = p_property_id and ph.position <> o.ord - 1;

  if p_cover_id is not null then
    update public.photos ph set is_cover = false
     where ph.property_id = p_property_id and ph.is_cover and ph.id <> p_cover_id;
    update public.photos ph set is_cover = true
     where ph.id = p_cover_id and not ph.is_cover;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- dashboard_chart: bookings that overlap [p_from, p_to) (including those started
-- before p_from), optionally for one property. Shown statuses: confirmed, blocked and
-- live holds. Window at most 366 days.
-- ---------------------------------------------------------------------------
create function public.dashboard_chart(
  p_from date,
  p_to date,
  p_property_id uuid default null
)
returns table (
  booking_id uuid,
  unit_id uuid,
  property_id uuid,
  check_in date,
  check_out date,
  status public.booking_status,
  source public.booking_source,
  guest_name text,
  adults integer,
  children integer,
  total_amount integer,
  currency text,
  hold_expires_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > 366 then
    raise exception 'invalid_dates' using errcode = '22023';
  end if;

  return query
  select b.id, b.unit_id, u.property_id, b.check_in, b.check_out, b.status, b.source,
         g.full_name, b.adults, b.children, b.total_amount, b.currency, b.hold_expires_at
    from public.bookings b
    join public.units u on u.id = b.unit_id
    left join public.guests g on g.id = b.guest_id
   where public.is_org_member(b.organization_id)
     and b.stay && daterange(p_from, p_to, '[)')
     and (p_property_id is null or u.property_id = p_property_id)
     and (b.status in ('confirmed', 'blocked')
          or (b.status = 'hold' and (b.hold_expires_at is null or b.hold_expires_at > now())))
   order by u.property_id, u.position, b.unit_id, b.check_in;
end
$$;

-- ---------------------------------------------------------------------------
-- dashboard_kpis: KPIs for one day (default: today in Europe/Bucharest), over all
-- organizations of the caller. Rules (also in docs/DB.md):
--   arrivals_today / departures_today: bookings confirmed or blocked with check_in / check_out = day
--   occupancy_pct: nights booked (confirmed or blocked) in [day, day + 30) / (units x 30) x 100, 1 decimal
--   revenue_month: sum(amount - refunded_amount) of payments 'succeeded' whose created_at falls in
--                  the calendar month of day, in Europe/Bucharest (bani)
-- ---------------------------------------------------------------------------
create function public.dashboard_kpis(p_day date default null)
returns table (
  kpi_day date,
  arrivals_today integer,
  departures_today integer,
  occupancy_pct numeric,
  revenue_month integer,
  currency text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with d as (
    select coalesce(p_day, public.bucharest_today()) as day
  ), w as (
    select d.day,
           daterange(d.day, d.day + 30, '[)') as win,
           date_trunc('month', d.day)::date as m0,
           (date_trunc('month', d.day) + interval '1 month')::date as m1
      from d
  ), active as (
    select b.check_in, b.check_out, b.stay
      from public.bookings b
     where public.is_org_member(b.organization_id)
       and b.status in ('confirmed', 'blocked')
  )
  select
    w.day,
    (select count(*)::integer from active a where a.check_in = w.day),
    (select count(*)::integer from active a where a.check_out = w.day),
    (select coalesce(round(100.0 * coalesce(sum(upper(a.stay * w.win) - lower(a.stay * w.win)), 0)
                     / nullif((select count(*) from public.units u where public.is_org_member(u.organization_id)) * 30, 0),
                     1), 0)
       from active a where a.stay && w.win),
    (select coalesce(sum(p.amount - p.refunded_amount), 0)::integer
       from public.payments p
      where public.is_org_member(p.organization_id)
        and p.status = 'succeeded'
        and (p.created_at at time zone 'Europe/Bucharest')::date >= w.m0
        and (p.created_at at time zone 'Europe/Bucharest')::date < w.m1),
    'RON'::text
  from w
$$;

-- ---------------------------------------------------------------------------
-- public_busy_ranges: busy intervals [busy_from, busy_to) of a published unit of an
-- active property. No guest, status, source, amount or token. Window at most 400 days.
-- ---------------------------------------------------------------------------
create function public.public_busy_ranges(p_unit_id uuid, p_from date, p_to date)
returns table (busy_from date, busy_to date)
language sql
stable
security definer
set search_path = ''
as $$
  select b.check_in, b.check_out
    from public.bookings b
    join public.units u on u.id = b.unit_id
    join public.properties p on p.id = u.property_id
   where b.unit_id = p_unit_id
     and u.is_published
     and p.status = 'activa'
     and p_from is not null and p_to > p_from and p_to - p_from <= 400
     -- No history for anon: the window starts at most one day before today (Europe/Bucharest).
     and b.stay && daterange(greatest(p_from, public.bucharest_today() - 1),
                             greatest(p_from, public.bucharest_today() - 1, p_to), '[)')
     and (b.status in ('confirmed', 'blocked')
          or (b.status = 'hold' and (b.hold_expires_at is null or b.hold_expires_at > now())))
   order by b.check_in
$$;

-- ---------------------------------------------------------------------------
-- Privileges: owner functions for authenticated only; busy ranges also for anon.
-- ---------------------------------------------------------------------------
revoke execute on function public.create_manual_booking(uuid, date, date, text, text, text, integer, integer, integer)
  from public, anon;
revoke execute on function public.reorder_photos(uuid, uuid[], uuid) from public, anon;
revoke execute on function public.dashboard_chart(date, date, uuid) from public, anon;
revoke execute on function public.dashboard_kpis(date) from public, anon;
revoke execute on function public.bucharest_today(timestamptz) from public, anon;

grant execute on function public.create_manual_booking(uuid, date, date, text, text, text, integer, integer, integer)
  to authenticated;
grant execute on function public.reorder_photos(uuid, uuid[], uuid) to authenticated;
grant execute on function public.dashboard_chart(date, date, uuid) to authenticated;
grant execute on function public.dashboard_kpis(date) to authenticated;
grant execute on function public.bucharest_today(timestamptz) to authenticated;

revoke execute on function public.public_busy_ranges(uuid, date, date) from public;
grant execute on function public.public_busy_ranges(uuid, date, date) to anon, authenticated;
