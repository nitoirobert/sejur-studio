-- 0008_booking_rules: each booking rule is written once.
--
--  * A hold must carry an expiry (bookings_hold_expiry_check). A hold with hold_expires_at null meant
--    "live forever" and every reader special-cased it.
--  * bookings.status has no default. The 0001 default 'hold' made a forgotten status a hold without
--    expiry (now refused anyway); 'confirmed' would silently occupy dates as a paid stay. Every writer
--    states it: create_manual_booking 'confirmed', the Stripe checkout 'hold' + expiry, iCal 'blocked'.
--  * is_live_booking(status, hold_expires_at) is the one definition of "this booking occupies the
--    calendar right now" for readers (confirmed, blocked, or a hold that has not expired). It was
--    copied into dashboard_chart and public_busy_ranges. The exclusion constraint cannot use it
--    (now() is not immutable): an expired hold keeps blocking its dates until expire_holds() runs.
--    It is a SQL-standard body (RETURN ...) without SET, so the planner inlines it into the caller's
--    query; names are bound when the function is created, so no search_path applies to it.
--  * expire_holds(unit) owns "release expired holds". create_manual_booking did it as a side effect;
--    the planned pg_cron job and the Stripe webhook call the same function.
--  * An imported booking carries its iCal event id, and one event is one booking per feed
--    (bookings_ical_event_key), so a re-sync can upsert on (ical_feed_id, external_uid).
--  * dashboard_kpis: revenue counts payments that were partly refunded too (net of the refund), and
--    the 30-day horizon is written once.
-- Function signatures and return types are unchanged; grants carry over from 0004. The two new
-- functions are granted to authenticated (owners) and service_role (Stripe webhook, cron); never to
-- PUBLIC or anon.

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
alter table public.bookings alter column status drop default;

alter table public.bookings
  add constraint bookings_hold_expiry_check check (status <> 'hold' or hold_expires_at is not null),
  add constraint bookings_ical_event_check check (ical_feed_id is null or external_uid is not null);

drop index public.bookings_ical_feed_idx;
alter table public.bookings add constraint bookings_ical_event_key unique (ical_feed_id, external_uid);

-- ---------------------------------------------------------------------------
-- Shared rules
-- ---------------------------------------------------------------------------
-- Live = confirmed, blocked, or a hold whose expiry is still in the future. A hold with
-- hold_expires_at = now() is not live: the exact complement of expire_holds() (<= now()).
-- Inlinable: language sql, stable, security invoker, no SET clause. The SQL-standard body is parsed
-- and bound at creation (pg_proc.prosqlbody), so it cannot be redirected through search_path.
create function public.is_live_booking(p_status public.booking_status, p_hold_expires_at timestamptz)
returns boolean
language sql
stable
return p_status in ('confirmed'::public.booking_status, 'blocked'::public.booking_status)
    or (p_status = 'hold'::public.booking_status and p_hold_expires_at > pg_catalog.now());

-- Moves expired holds (of one unit, or all visible ones) to 'expired'. Security invoker: an owner
-- releases only their own organization's holds (RLS); the cron role sees all. Returns the count.
create function public.expire_holds(p_unit_id uuid default null)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  with expired as (
    update public.bookings b
       set status = 'expired'
     where b.status = 'hold'
       and b.hold_expires_at <= now()
       and (p_unit_id is null or b.unit_id = p_unit_id)
    returning 1
  )
  select count(*)::integer from expired
$$;

revoke execute on function public.is_live_booking(public.booking_status, timestamptz) from public, anon;
revoke execute on function public.expire_holds(uuid) from public, anon;
grant execute on function public.is_live_booking(public.booking_status, timestamptz) to authenticated, service_role;
grant execute on function public.expire_holds(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_manual_booking: releases expired holds through expire_holds()
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
-- dashboard_chart: live bookings through is_live_booking()
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_chart(
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
     and public.is_live_booking(b.status, b.hold_expires_at)
   order by u.property_id, u.position, b.unit_id, b.check_in;
end
$$;

-- ---------------------------------------------------------------------------
-- dashboard_kpis: rules as in docs/DB.md. Revenue = amount - refunded_amount of payments that were
-- paid (succeeded) or partly refunded, in the calendar month of the day (Europe/Bucharest).
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_kpis(p_day date default null)
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
    select coalesce(p_day, public.bucharest_today()) as day, 30 as horizon_days
  ), w as (
    select d.day,
           d.horizon_days,
           daterange(d.day, d.day + d.horizon_days, '[)') as win,
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
                     / nullif((select count(*) from public.units u where public.is_org_member(u.organization_id))
                              * w.horizon_days, 0),
                     1), 0)
       from active a where a.stay && w.win),
    (select coalesce(sum(p.amount - p.refunded_amount), 0)::integer
       from public.payments p
      where public.is_org_member(p.organization_id)
        and p.status in ('succeeded', 'partially_refunded')
        and (p.created_at at time zone 'Europe/Bucharest')::date >= w.m0
        and (p.created_at at time zone 'Europe/Bucharest')::date < w.m1),
    'RON'::text
  from w
$$;

-- ---------------------------------------------------------------------------
-- public_busy_ranges: live bookings through is_live_booking(). Still security definer, so the
-- "published unit of an active property" rule is repeated here: RLS cannot be applied inside it.
-- Keep it in step with properties_public / units_public (0002).
-- ---------------------------------------------------------------------------
create or replace function public.public_busy_ranges(p_unit_id uuid, p_from date, p_to date)
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
     and public.is_live_booking(b.status, b.hold_expires_at)
   order by b.check_in
$$;
