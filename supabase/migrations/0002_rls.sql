-- 0002_rls: row level security on every table, grants for anon / authenticated.
--
-- Owners (role `authenticated`) see and write only rows of their organizations.
-- Anon (Robert's public page, cookie-less client) reads only: active properties
-- (without checkin_instructions), published units, their prices and photos.
-- Busy days for anon come from public.public_busy_ranges() (0004).

-- ---------------------------------------------------------------------------
-- Membership check used by every policy. stable + security definer, so the planner
-- evaluates it once per statement value and it does not recurse into RLS.
-- ---------------------------------------------------------------------------
create function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = (select auth.uid())
  )
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.profiles enable row level security;
alter table public.cancellation_policies enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.unit_prices enable row level security;
alter table public.photos enable row level security;
alter table public.guests enable row level security;
alter table public.ical_feeds enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.sync_conflicts enable row level security;

-- ---------------------------------------------------------------------------
-- Grants. Supabase grants everything to anon/authenticated by default; narrow it.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
-- Future tables/sequences/functions in public are not exposed to anon unless granted explicitly.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
-- The PUBLIC execute default is global (not per schema), so it must be revoked without `in schema`;
-- every function below then needs an explicit grant (anon only for public_busy_ranges).
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- anon: public catalogue only (rows filtered by the anon policies below)
grant select (id, organization_id, name, slug, description, address, city, lat, lng, timezone,
              check_in_time, check_out_time, cancellation_policy_id, amenities, status,
              created_at, updated_at)
  on public.properties to anon;
grant select on public.units, public.unit_prices, public.photos to anon;

-- authenticated: organizations and members are managed by the signup trigger / service role
revoke insert, update, delete on public.organizations from authenticated;
grant update (name, country, legal_name, cui, reg_com, billing_address) on public.organizations to authenticated;
revoke insert, update, delete on public.organization_members from authenticated;
revoke insert, delete on public.profiles from authenticated;
-- payments are written only by the Stripe webhook (service role)
revoke insert, update, delete on public.payments from authenticated;

-- ---------------------------------------------------------------------------
-- Policies: authenticated (owners)
-- ---------------------------------------------------------------------------
create policy organizations_select on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy organizations_update on public.organizations
  for update to authenticated using (public.is_org_member(id)) with check (public.is_org_member(id));

create policy organization_members_select on public.organization_members
  for select to authenticated using (public.is_org_member(organization_id));

create policy profiles_select on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update on public.profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy payments_select on public.payments
  for select to authenticated using (public.is_org_member(organization_id));

do $$
declare t text;
begin
  foreach t in array array['cancellation_policies', 'properties', 'units', 'unit_prices', 'photos',
                           'guests', 'ical_feeds', 'bookings', 'sync_conflicts']
  loop
    execute format('create policy %I on public.%I for all to authenticated
                    using (public.is_org_member(organization_id))
                    with check (public.is_org_member(organization_id))', t || '_owner', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Policies: anon (public page)
-- ---------------------------------------------------------------------------
create policy properties_public on public.properties
  for select to anon using (status = 'activa');

create policy units_public on public.units
  for select to anon using (
    is_published
    and exists (select 1 from public.properties p where p.id = units.property_id and p.status = 'activa')
  );

create policy unit_prices_public on public.unit_prices
  for select to anon using (
    exists (
      select 1 from public.units u join public.properties p on p.id = u.property_id
      where u.id = unit_prices.unit_id and u.is_published and p.status = 'activa'
    )
  );

create policy photos_public on public.photos
  for select to anon using (
    exists (select 1 from public.properties p where p.id = photos.property_id and p.status = 'activa')
    and (
      photos.unit_id is null
      or exists (select 1 from public.units u where u.id = photos.unit_id and u.is_published)
    )
  );

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on function public.is_org_member(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.enforce_organization() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
