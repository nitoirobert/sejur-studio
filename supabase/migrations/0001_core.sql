-- 0001_core: tables, enums, constraints, indexes, updated_at and organization triggers.
-- Money is integer bani (1 leu = 100 bani), never float. Dates are `date`, stays are [check_in, check_out).

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner');
create type public.property_status as enum ('activa', 'ascunsa');
create type public.unit_type as enum ('camera', 'apartament', 'garsoniera', 'casuta');
create type public.price_kind as enum ('base', 'weekend', 'season');
create type public.booking_status as enum ('hold', 'confirmed', 'blocked', 'cancelled', 'expired');
create type public.booking_source as enum ('direct', 'booking', 'airbnb', 'altul');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded');
create type public.ical_provider as enum ('booking', 'airbnb', 'altul');

-- ---------------------------------------------------------------------------
-- Generic trigger: updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique,
  country text not null default 'RO' check (country ~ '^[A-Z]{2}$'),
  stripe_account_id text unique,
  legal_name text,
  cui text,
  reg_com text,
  billing_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index organization_members_user_org_idx on public.organization_members (user_id, organization_id);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cancellation_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- e.g. [{"days_before": 14, "refund_percent": 100}, {"days_before": 3, "refund_percent": 50}]
  rules jsonb not null default '[]'::jsonb check (jsonb_typeof(rules) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cancellation_policies_org_idx on public.cancellation_policies (organization_id);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  address text,
  city text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  timezone text not null default 'Europe/Bucharest',
  check_in_time time not null default '15:00',
  check_out_time time not null default '11:00',
  checkin_instructions text,   -- private: never granted to anon
  cancellation_policy_id uuid references public.cancellation_policies (id) on delete set null,
  amenities jsonb not null default '[]'::jsonb check (jsonb_typeof(amenities) = 'array'),
  status public.property_status not null default 'ascunsa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index properties_org_idx on public.properties (organization_id);
create index properties_cancellation_policy_idx on public.properties (cancellation_policy_id);
create index properties_active_idx on public.properties (status) where status = 'activa';

create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  type public.unit_type not null,
  max_guests integer not null check (max_guests > 0),
  bedrooms integer not null default 1 check (bedrooms >= 0),
  beds integer not null default 1 check (beds >= 0),
  bathrooms integer not null default 1 check (bathrooms >= 0),
  area_m2 integer check (area_m2 > 0),
  description text,
  amenities jsonb not null default '[]'::jsonb check (jsonb_typeof(amenities) = 'array'),
  position integer not null default 0 check (position >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index units_org_idx on public.units (organization_id);
create index units_property_idx on public.units (property_id, position);

create table public.unit_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  kind public.price_kind not null,
  price_per_night integer not null check (price_per_night >= 0),
  date_from date,
  date_to date,                 -- exclusive
  min_nights integer not null default 1 check (min_nights >= 1),
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_prices_dates_check check (date_from is null or date_to is null or date_to > date_from),
  constraint unit_prices_season_dates check (kind <> 'season' or (date_from is not null and date_to is not null))
);
create index unit_prices_org_idx on public.unit_prices (organization_id);
create index unit_prices_unit_idx on public.unit_prices (unit_id, kind);
create unique index unit_prices_one_base_idx on public.unit_prices (unit_id) where kind = 'base';

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  unit_id uuid references public.units (id) on delete cascade,
  storage_path text not null unique,   -- <organization_id>/<property_id>/<file> in bucket `photos`
  position integer not null default 0 check (position >= 0),
  is_cover boolean not null default false,
  alt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The path must live under this row's own organization and property (no squatting other folders).
  -- organization_id itself is forced to the property's org by enforce_organization().
  constraint photos_storage_path_owner check (
    split_part(storage_path, '/', 1) = organization_id::text
    and split_part(storage_path, '/', 2) = property_id::text
    and split_part(storage_path, '/', 3) <> ''
    and storage_path !~ '(^|/)\.\.?(/|$)'
  )
);
create index photos_org_idx on public.photos (organization_id);
create index photos_property_idx on public.photos (property_id, position);
create index photos_unit_idx on public.photos (unit_id);
create unique index photos_one_cover_idx on public.photos (property_id) where is_cover;

-- GDPR: minimum data only (name, email, phone).
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guests_org_idx on public.guests (organization_id);

create table public.ical_feeds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  url text not null,
  provider public.ical_provider not null,
  last_sync_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ical_feeds_org_idx on public.ical_feeds (organization_id);
create index ical_feeds_unit_idx on public.ical_feeds (unit_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete restrict,
  guest_id uuid references public.guests (id) on delete set null,
  ical_feed_id uuid references public.ical_feeds (id) on delete set null,
  external_uid text,
  check_in date not null,
  check_out date not null,
  -- greatest() keeps the expression valid for bad input, so the check below reports 23514.
  stay daterange generated always as (daterange(check_in, greatest(check_in, check_out), '[)')) stored,
  status public.booking_status not null default 'hold',
  source public.booking_source not null default 'direct',
  adults integer not null default 1 check (adults >= 0),
  children integer not null default 0 check (children >= 0),
  total_amount integer not null default 0 check (total_amount >= 0),
  currency text not null default 'RON' check (currency ~ '^[A-Z]{3}$'),
  hold_expires_at timestamptz,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  public_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_dates_check check (check_out > check_in),
  constraint bookings_no_overlap exclude using gist (unit_id with =, stay with &&)
    where (status in ('hold', 'confirmed', 'blocked'))
);
create index bookings_org_idx on public.bookings (organization_id, check_in);
create index bookings_unit_check_in_idx on public.bookings (unit_id, check_in);
create index bookings_guest_idx on public.bookings (guest_id);
create index bookings_ical_feed_idx on public.bookings (ical_feed_id, external_uid);
create index bookings_active_idx on public.bookings (unit_id, check_in, check_out)
  where status in ('hold', 'confirmed', 'blocked');
create index bookings_holds_idx on public.bookings (hold_expires_at) where status = 'hold';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  amount integer not null check (amount >= 0),
  refunded_amount integer not null default 0 check (refunded_amount >= 0),
  currency text not null default 'RON' check (currency ~ '^[A-Z]{3}$'),
  status public.payment_status not null default 'pending',
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_refund_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_refund_check check (refunded_amount <= amount)
);
create index payments_org_idx on public.payments (organization_id, created_at);
create index payments_booking_idx on public.payments (booking_id);

create table public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  feed_id uuid references public.ical_feeds (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  external_uid text,
  conflict_range daterange not null,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sync_conflicts_org_idx on public.sync_conflicts (organization_id, resolved);
create index sync_conflicts_unit_idx on public.sync_conflicts (unit_id);
create index sync_conflicts_feed_idx on public.sync_conflicts (feed_id);
create index sync_conflicts_booking_idx on public.sync_conflicts (booking_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers on every table
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['organizations', 'organization_members', 'profiles', 'cancellation_policies',
                           'properties', 'units', 'unit_prices', 'photos', 'guests', 'ical_feeds',
                           'bookings', 'payments', 'sync_conflicts']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Organization consistency: a child row always carries its parent's organization_id.
-- Fills organization_id when null; refuses (42501) a row whose organization differs from
-- its parent, or that links rows of another organization. Runs before RLS WITH CHECK.
-- ---------------------------------------------------------------------------
create function public.enforce_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if tg_table_name = 'units' then
    select p.organization_id into v_org from public.properties p where p.id = new.property_id;
  elsif tg_table_name in ('unit_prices', 'ical_feeds', 'bookings', 'sync_conflicts') then
    select u.organization_id into v_org from public.units u where u.id = new.unit_id;
  elsif tg_table_name = 'photos' then
    select p.organization_id into v_org from public.properties p where p.id = new.property_id;
    if new.unit_id is not null and not exists (
      select 1 from public.units u where u.id = new.unit_id and u.property_id = new.property_id
    ) then
      raise exception 'unit_not_in_property' using errcode = '42501';
    end if;
  elsif tg_table_name = 'payments' then
    select b.organization_id into v_org from public.bookings b where b.id = new.booking_id;
  elsif tg_table_name = 'properties' then
    if new.cancellation_policy_id is not null and not exists (
      select 1 from public.cancellation_policies c
      where c.id = new.cancellation_policy_id and c.organization_id = new.organization_id
    ) then
      raise exception 'organization_mismatch' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Missing parent: leave the row as is; RLS / foreign keys refuse it.
  if v_org is null then
    return new;
  end if;

  if new.organization_id is null then
    new.organization_id := v_org;
  elsif new.organization_id <> v_org then
    raise exception 'organization_mismatch' using errcode = '42501';
  end if;

  if tg_table_name = 'bookings' then
    if new.guest_id is not null and not exists (
      select 1 from public.guests g where g.id = new.guest_id and g.organization_id = v_org
    ) then
      raise exception 'organization_mismatch' using errcode = '42501';
    end if;
    if new.ical_feed_id is not null and not exists (
      select 1 from public.ical_feeds f where f.id = new.ical_feed_id and f.organization_id = v_org
    ) then
      raise exception 'organization_mismatch' using errcode = '42501';
    end if;
  elsif tg_table_name = 'sync_conflicts' then
    if (new.feed_id is not null and not exists (
          select 1 from public.ical_feeds f where f.id = new.feed_id and f.organization_id = v_org))
       or (new.booking_id is not null and not exists (
          select 1 from public.bookings b where b.id = new.booking_id and b.organization_id = v_org)) then
      raise exception 'organization_mismatch' using errcode = '42501';
    end if;
  end if;

  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['properties', 'units', 'unit_prices', 'photos', 'ical_feeds', 'bookings',
                           'payments', 'sync_conflicts']
  loop
    execute format('create trigger enforce_organization before insert or update on public.%I
                    for each row execute function public.enforce_organization()', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> own organization + owner membership + profile.
-- Never reads organization or role from user metadata (only full_name, as a label).
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
begin
  insert into public.organizations (name, slug)
  values (coalesce(v_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Organizația mea'),
          'org-' || replace(new.id::text, '-', ''))
  returning id into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org, new.id, 'owner');

  insert into public.profiles (user_id, full_name)
  values (new.id, v_name);

  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
